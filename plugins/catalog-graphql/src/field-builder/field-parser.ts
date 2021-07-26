/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  InputTypeComposer,
  ObjectTypeComposer,
  ObjectTypeComposerFieldConfigMapDefinition,
  schemaComposer,
} from 'graphql-compose';
import { GraphQLJSONObject } from 'graphql-type-json';
import {
  isArray,
  isBoolean,
  isNumber,
  isObjectLike,
  isInteger,
  isString,
  isDate,
  upperFirst,
} from 'lodash';
import {
  getNamedType,
  getNullableType,
  GraphQLInputObjectType,
  GraphQLList,
} from 'graphql';
import { getQueryOperatorInput } from './filters';

const createTypeName = selector => {
  const keys = selector.split(`.`);
  const suffix = keys.slice(1).map(upperFirst).join(``);
  return `${keys[0]}${suffix}`;
};

const NON_ALPHA_NUMERIC_EXPR = /[^_0-9A-Za-z]+/g;

/**
 * GraphQL field names must be a string and cannot contain anything other than
 * alphanumeric characters and `_`. They also can't start with `__` which is
 * reserved for internal fields (`___foo` doesn't work either).
 */
const createFieldName = name => {
  const replaced = name.replace(NON_ALPHA_NUMERIC_EXPR, `_`);

  // key is invalid; normalize with leading underscore and rest with x
  if (replaced.match(/^__/)) {
    return replaced.replace(/_/g, (char, index) => (index === 0 ? `_` : `x`));
  }

  // key is invalid (starts with numeric); normalize with leading underscore
  if (replaced.match(/^[0-9]/)) {
    return `_${replaced}`;
  }

  return replaced;
};

/**
 * Given an object, it recursively converts all its properties into graphql schema
 *
 * {
 *  entities: {
 *    foo: 'hello'
 *    bar: 1
 *  }
 * }
 *
 */

class FieldBuilder {
  value: any;
  name: string;
  fieldName: string;
  selector: string;
  type: any;
  isArray: boolean = false;
  constructor({
    selector,
    name,
    value,
  }: {
    selector: string;
    name: string;
    value: any;
  }) {
    this.value = value;
    this.name = name;
    this.selector = selector;
    // TODO: Will this collide?
    this.fieldName = createFieldName(name);

    if (isArray(this.value)) {
      this.value = this.value[0]; // TODO: we take the first object as example, probably not the best.
      this.isArray = true;
    }
  }

  getFieldConfig = () => {
    const value = this.value;
    if (isBoolean(value)) return { type: 'Boolean' };
    if (isNumber(value)) return { type: isInteger(value) ? 'Int' : 'Float' };

    if (isString(value)) {
      if (isDate(value)) {
        return { type: 'Date' };
      }
      return { type: 'String' };
    }

    // it never gets there, because we are converting arrays into a "sample" of one of its elements.
    // Could we have an array of arrays?
    if (isArray(value)) {
      return { type: GraphQLJSONObject };
    }

    if (isObjectLike(value)) {
      if (isDate(value)) {
        return { type: 'Date' };
      }

      if (value instanceof String) {
        return { type: 'String' };
      }
      if (value) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const field = new ObjectBuilder({
          parentName: this.selector,
          name: this.name,
          obj: this.value,
        });

        return {
          type: field.getOTC(),
          filter: this.isArray
            ? // eslint-disable-next-line @typescript-eslint/no-use-before-define
              ObjectBuilder.getFilterArgs({
                itc: field.getOTC().getInputTypeComposer(),
              })
            : null,
        };
      }
    }

    throw new Error(
      `Can't determine type for "${JSON.stringify(value)}" in \`${
        this.name
      }\`.`,
    );
  };

  build = (): ObjectTypeComposerFieldConfigMapDefinition<any, any> => {
    const fieldConfig = this.getFieldConfig();

    return {
      [this.fieldName]: {
        args: this.isArray
          ? {
              filter: fieldConfig.filter ? fieldConfig.filter : 'String',
              skip: 'Int',
              limit: 'Int',
            }
          : {},
        type: this.isArray ? [fieldConfig.type] : fieldConfig.type,
        resolve: (parent: any) => parent[this.name],
      },
    };
  };
}

export class ObjectBuilder {
  obj = {};
  name: string;
  typeName: string;
  parentName: string;
  typeOTC: ObjectTypeComposer<any, any>;
  fieldName: string;
  constructor({
    parentName = '',
    name,
    obj,
  }: {
    parentName?: string;
    name: string;
    obj: {};
  }) {
    this.parentName = parentName;
    this.obj = obj;
    this.name = name;
    this.fieldName = createFieldName(name);
    // TODO: Will these collide?
    this.typeName = createTypeName(`${parentName}.${this.fieldName}`);

    this.typeOTC = schemaComposer.getOrCreateOTC(this.typeName, otc => {
      otc.addFields({
        raw: {
          type: GraphQLJSONObject,
          resolve: (parent: any) => parent,
        },
      });
    });

    this.processEntries();
  }

  addField = (obj: ObjectTypeComposerFieldConfigMapDefinition<any, any>) => {
    this.typeOTC.addFields(obj);
  };

  processEntries = () => {
    Object.entries(this.obj).forEach(([fieldName, value]) => {
      this.addField(
        new FieldBuilder({
          selector: this.typeName,
          name: fieldName,
          value,
        }).build(),
      );
    });
  };

  static getFilterArgs = ({
    itc,
  }: {
    itc: InputTypeComposer<any>;
  }): InputTypeComposer => {
    const fields = itc.getFields();

    const inputTypeName = itc.getTypeName().replace(/Input$/, `FilterInput`);
    const filterInputComposer = schemaComposer.getOrCreateITC(inputTypeName);

    schemaComposer.add(filterInputComposer); // TODO: Needed?

    const filterFields: { [key in string]: InputTypeComposer<any> } = {};

    Object.keys(fields).forEach(fieldName => {
      const fieldConfig = itc.getFieldConfig(fieldName);
      const type = getNamedType(fieldConfig.type);

      if (type instanceof GraphQLInputObjectType) {
        const typeComposer = schemaComposer.getAnyTC(
          type.name.replace(/Input$/, ``),
        );
        const newItc = new InputTypeComposer(type, schemaComposer);

        const argsItc = ObjectBuilder.getFilterArgs({ itc: newItc });

        const isListType =
          getNullableType(fieldConfig.type) instanceof GraphQLList;

        if (isListType) {
          const typeName = itc.getTypeName().replace(/Input/, `ListInput`);

          filterFields[fieldName] = schemaComposer.getOrCreateITC(
            typeName,
            listItc => {
              listItc.addFields({
                elemMatch: argsItc,
              });
            },
          );
        } else {
          filterFields[fieldName] = argsItc;
        }
      } else {
        const operatorFields = getQueryOperatorInput({
          schemaComposer,
          type,
        });

        if (operatorFields) {
          filterFields[fieldName] = operatorFields;
        }
      }
    });

    filterInputComposer.addFields(filterFields);
    return filterInputComposer;
  };

  getOTC = (): ObjectTypeComposer<any, any> => {
    return this.typeOTC;
  };
}
