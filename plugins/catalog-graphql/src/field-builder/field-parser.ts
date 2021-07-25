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
  toUpper,
  camelCase,
} from 'lodash';
import { GraphQLScalarType } from 'graphql';

const sanitize = (string: string) => {
  const regex = /[^_0-9A-Za-z]+/g;
  return string.replace(regex, '_');
};

const pascalCase = (str: string) => camelCase(str).replace(/^(.)/, toUpper);
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

type FieldType =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Boolean'
  | '[String]'
  | '[Int]'
  | '[Float]'
  | '[Boolean]'
  | '__Object__'
  | '[__Object__]'
  | GraphQLScalarType
  | [GraphQLScalarType];

class FieldBuilder {
  value: any;
  name: string;
  fieldName: string;
  parentName: string;
  type: FieldType;

  constructor({
    parentName = '',
    name,
    value,
  }: {
    parentName?: string;
    name: string;
    value: any;
  }) {
    this.value = value;
    this.name = name;
    this.parentName = parentName;
    // TODO: Will this collide?
    this.fieldName = camelCase(sanitize(name));
    this.type = this.getType(this.value);
  }

  getType = (value: any): FieldType => {
    if (isBoolean(value)) return 'Boolean';
    if (isNumber(value)) return 'Int';

    if (isArray(value)) {
      const type: FieldType = this.getType(value[0]);
      return isArray(value[0])
        ? [GraphQLJSONObject]
        : (`[${type}]` as FieldType);
    }

    if (isObjectLike(value)) return '__Object__';
    return 'String';
  };

  buildObject = ({
    name,
    obj,
    returnArray = false,
  }: {
    name: string;
    obj: {};
    returnArray?: boolean;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const fieldTC = new ObjectBuilder({
      parentName: this.parentName,
      name,
      obj,
    }).build();

    return {
      [this.fieldName]: returnArray ? [fieldTC] : fieldTC,
    };
  };

  build = (): ObjectTypeComposerFieldConfigMapDefinition<any, any> => {
    if (this.type === '[__Object__]') {
      return this.buildObject({
        name: this.name,
        obj: this.value[0],
        returnArray: true,
      });
    }

    if (this.type === '__Object__') {
      return this.buildObject({ name: this.name, obj: this.value });
    }

    return {
      [this.fieldName]: {
        type: this.type,
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
  typeTC: ObjectTypeComposer<any, any>;

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
    // TODO: Will these collide?
    this.typeName = pascalCase(sanitize(`${parentName}_${name}`));

    this.typeTC = schemaComposer.createObjectTC({
      name: this.typeName,
      fields: {
        // We let anyone query the raw obj
        raw: {
          type: GraphQLJSONObject,
          resolve: (parent: any) => parent,
        },
      },
    });

    this.processEntries();
  }

  addField = (obj: ObjectTypeComposerFieldConfigMapDefinition<any, any>) => {
    this.typeTC.addFields(obj);
  };

  processEntries = () => {
    Object.entries(this.obj).forEach(([fieldName, value]) => {
      this.addField(
        new FieldBuilder({
          parentName: this.typeName,
          name: fieldName,
          value,
        }).build(),
      );
    });
  };

  build = (): ObjectTypeComposer<any, any> => this.typeTC;
}
