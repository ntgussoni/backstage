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
  isArray,
  isBoolean,
  isNumber,
  isString,
  mergeWith,
  MergeWithCustomizer,
} from 'lodash';

const customizer: MergeWithCustomizer = (
  mergedValue,
  srcValue,
  key,
  object,
  source,
) => {
  if (isArray(mergedValue)) {
    return mergedValue.concat(srcValue);
  }
  if (isNumber(mergedValue) && isString(srcValue)) return srcValue;
  if (isNumber(srcValue) && isString(mergedValue)) return mergedValue;

  if (isBoolean(mergedValue) && isString(srcValue)) return srcValue;
  if (isBoolean(srcValue) && isString(mergedValue)) return mergedValue;

  if (isBoolean(mergedValue) && isNumber(srcValue)) return srcValue;
  if (isBoolean(srcValue) && isNumber(mergedValue)) return mergedValue;

  return undefined;
};

export const fieldMerger = (...entries: any) => {
  const mergedObj = {};
  mergeWith(mergedObj, ...entries, customizer);
  return mergedObj;
};
