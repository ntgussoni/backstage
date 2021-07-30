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

import { schemaComposer, GraphQLJSONObject } from 'graphql-compose';
import { buildField } from './field-builder';
import { createFieldName, createTypeName } from './utils';

export const buildObject = ({
  parentName = '',
  name,
  obj,
}: {
  parentName?: string;
  name: string;
  obj: {};
}) => {
  const fieldName = createFieldName(name);
  // TODO: Will these collide?
  const typeName = createTypeName(`${parentName}.${fieldName}`);
  const typeOTC = schemaComposer.getOrCreateOTC(typeName, otc => {
    otc.addFields({
      raw: {
        type: GraphQLJSONObject,
        resolve: (parent: any) => parent,
      },
    });
  });

  Object.entries(obj).forEach(([childFieldName, value]) => {
    typeOTC.addFields(
      buildField({
        selector: typeName,
        name: childFieldName,
        value,
      }),
    );
  });

  return typeOTC;
};
