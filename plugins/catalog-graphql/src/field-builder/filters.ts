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
  GraphQLEnumType,
  GraphQLScalarType,
  isSpecifiedScalarType,
} from 'graphql';
import {
  GraphQLDate,
  GraphQLJSON,
  InputTypeComposer,
  SchemaComposer,
} from 'graphql-compose';
import { isObject } from 'lodash';
import sift from 'sift';

const EQ = `eq`;
const NE = `ne`;
const GT = `gt`;
const GTE = `gte`;
const LT = `lt`;
const LTE = `lte`;
const IN = `in`;
const NIN = `nin`;
const REGEX = `regex`;
// const GLOB = `glob`; need to add support to sift

const ALLOWED_OPERATORS = {
  Boolean: [EQ, NE, IN, NIN],
  Date: [EQ, NE, GT, GTE, LT, LTE, IN, NIN],
  Float: [EQ, NE, GT, GTE, LT, LTE, IN, NIN],
  ID: [EQ, NE, IN, NIN],
  Int: [EQ, NE, GT, GTE, LT, LTE, IN, NIN],
  JSON: [EQ, NE, IN, NIN, REGEX /* , GLOB*/],
  String: [EQ, NE, IN, NIN, REGEX /* , GLOB*/],
  Enum: [EQ, NE, IN, NIN],
  CustomScalar: [EQ, NE, IN, NIN],
};

type TypeName = keyof typeof ALLOWED_OPERATORS;

const ARRAY_OPERATORS = [IN, NIN];

const getOperatorFields = (
  fieldType: string,
  operators: Array<string>,
): Record<string, string | Array<string>> => {
  const result: { [key in string]: any } = {};
  operators.forEach(op => {
    if (ARRAY_OPERATORS.includes(op)) {
      result[op] = [fieldType];
    } else {
      result[op] = fieldType;
    }
  });
  return result;
};

const isBuiltInScalarType = (type: any): type is GraphQLScalarType =>
  isSpecifiedScalarType(type) || type === GraphQLDate || type === GraphQLJSON;

export const getQueryOperatorInput = ({
  schemaComposer,
  type,
}: {
  schemaComposer: SchemaComposer;
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

/* 

Sift uses this kind of notation

 "fields.firstName.value": {
    $eq: "Jimmy"
  }

*/
function toDottedObject(
  obj: Record<any, any>,
  target: Record<any, any> = {},
  path: string[] = [],
): Record<string, any> {
  Object.keys(obj).forEach(key => {
    if (isObject(obj[key])) {
      toDottedObject(obj[key], target, path.concat(key));
    } else {
      target[path.join('.')] = {
        ...target[path.join('.')],
        [`$${key}`]: obj[key],
      };
    }
  });
  return target;
}

export function filterToSift(
  filter = {},
): (item: unknown, key?: string | number, owner?: any) => boolean {
  return sift(toDottedObject(filter));
}
