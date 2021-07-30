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

import { isObject, upperFirst } from 'lodash';
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

export const ALLOWED_OPERATORS = {
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

export type TypeName = keyof typeof ALLOWED_OPERATORS;
export const ARRAY_OPERATORS = [IN, NIN];
export const NON_ALPHA_NUMERIC_EXPR = /[^_0-9A-Za-z]+/g;

export const createTypeName = (selector: string) => {
  const keys = selector.split(`.`);
  const suffix = keys.slice(1).map(upperFirst).join(``);
  return `${keys[0]}${suffix}`;
};

/**
 * GraphQL field names must be a string and cannot contain anything other than
 * alphanumeric characters and `_`.
 */
export const createFieldName = (name: string) => {
  const replaced = name.replace(NON_ALPHA_NUMERIC_EXPR, `_`);

  // key is invalid (starts with numeric); normalize with leading underscore
  if (replaced.match(/^[0-9]/)) {
    return `_${replaced}`;
  }

  return replaced;
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
