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
  getNamedType,
  getNullableType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLScalarType,
  isSpecifiedScalarType,
} from 'graphql';
import {
  GraphQLDate,
  GraphQLJSON,
  InputTypeComposer,
  schemaComposer,
} from 'graphql-compose';
import { isArray } from 'lodash';
import {
  ALLOWED_OPERATORS,
  ARRAY_OPERATORS,
  filterToSift,
  TypeName,
} from './utils';

const getOperatorFields = (
  fieldType: string,
  operators: Array<string>,
): Record<string, string | Array<string>> => {
  const result: { [key in string]: any } = {};
  operators.forEach(op => {
    result[op] = ARRAY_OPERATORS.includes(op) ? [fieldType] : fieldType;
  });
  return result;
};

/**
 * Is the type one of the built-in grahql types?
 */
const isBuiltInScalarType = (type: any): type is GraphQLScalarType =>
  isSpecifiedScalarType(type) || type === GraphQLDate || type === GraphQLJSON;

/**
 * It will generate an input with the search operators specific for the type
 * @param type The field type
 * @returns InputTypeComposer
 */
export const getQueryOperatorInput = ({
  type,
}: {
  type: any;
}): InputTypeComposer => {
  let typeName: TypeName;

  if (type instanceof GraphQLEnumType) {
    typeName = `Enum`;
  } else if (isBuiltInScalarType(type)) {
    typeName = type.name as Exclude<TypeName, 'Enum' | 'CustomScalar'>;
  } else {
    typeName = `CustomScalar`;
  }
  const operators = ALLOWED_OPERATORS[typeName];

  return schemaComposer.getOrCreateITC(`${type.name}QueryOperatorInput`, itc =>
    itc.addFields(getOperatorFields(type, operators)),
  );
};

/**
 * Based on a field, we generate the filter arguments
 * @param itc InputTypeComposer
 * @returns
 */
export const getFilterArgs = ({
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
      // Is it an object?
      const newItc = new InputTypeComposer(type, schemaComposer);

      const argsItc = getFilterArgs({ itc: newItc });

      const isListType =
        getNullableType(fieldConfig.type) instanceof GraphQLList;

      if (isListType) {
        // It's a list, so we generate a new listiInput type with elemMatch
        // TODO: elemMatch doesn't currently work. Need to convert this to the mongodb-way

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

export const filterOutput = ({
  args,
  arr,
}: {
  args: { filter?: any; limit?: number; skip?: number };
  arr: {};
}) => {
  if (!isArray(arr)) return arr;
  const { filter, limit = -1, skip = 0 } = args;
  const result = filter ? arr.filter(filterToSift(filter)) : arr;
  if (result.length === 0) return result;
  if (limit >= 0) {
    return result.slice(skip, skip + limit);
  }
  return result;
};
