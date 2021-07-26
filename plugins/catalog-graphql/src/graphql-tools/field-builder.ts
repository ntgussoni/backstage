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
  ObjectTypeComposerArgumentConfigMapDefinition,
  ObjectTypeComposerFieldConfigMapDefinition,
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
} from 'lodash';
import { filterOutput, getFilterArgs } from './filters';
import { buildObject } from './object-builder';
import { createFieldName } from './utils';

const getFieldConfig = ({
  value,
  selector,
  name,
  _isArray,
}: {
  value: any;
  selector: string;
  name: string;
  _isArray: boolean;
}) => {
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
      const field = buildObject({
        parentName: selector,
        name,
        obj: value,
      });

      return {
        type: field,
        filter: _isArray
          ? // eslint-disable-next-line @typescript-eslint/no-use-before-define
            getFilterArgs({
              itc: field.getInputTypeComposer(),
            })
          : null,
      };
    }
  }

  throw new Error(
    `Can't determine type for "${JSON.stringify(value)}" in \`${name}\`.`,
  );
};

export const buildField = ({
  selector,
  name,
  value,
}: {
  selector: string;
  name: string;
  value: any;
}): ObjectTypeComposerFieldConfigMapDefinition<any, any> => {
  const _isArray = isArray(value);
  const _value = _isArray ? value[0] : value; // TODO: we take the first object as example, probably not the best.
  const fieldName = createFieldName(name);
  const fieldConfig = getFieldConfig({
    value: _value,
    _isArray,
    selector,
    name,
  });
  const args: ObjectTypeComposerArgumentConfigMapDefinition<any> = _isArray
    ? {
        filter: fieldConfig.filter ? fieldConfig.filter : 'String',
        skip: 'Int',
        limit: 'Int',
      }
    : {};

  return {
    [fieldName]: {
      args,
      type: _isArray ? [fieldConfig.type] : fieldConfig.type,
      resolve: (source, resolverArgs) => {
        return filterOutput({ args: resolverArgs, arr: source[name] });
      },
    },
  };
};
