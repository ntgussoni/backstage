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
  NamedTypeComposer,
  ObjectTypeComposer,
  SchemaComposer,
  ObjectTypeComposerAsObjectDefinition,
} from 'graphql-compose';
import { isFunction } from 'lodash';

// This has to be in order of execution
const SPECIAL_FUNCTIONS = ['customizeSchema'];

const processType = ({
  schemaComposer,
  typeComposer,
  pluginFieldExtensions,
}: {
  schemaComposer: SchemaComposer<any>;
  typeComposer: NamedTypeComposer<any>;
  pluginFieldExtensions: {
    [key in string]: ObjectTypeComposerAsObjectDefinition<any, any>;
  };
}) => {
  if (typeComposer instanceof ObjectTypeComposer) {
    const type = pluginFieldExtensions[typeComposer.getTypeName()];

    void (type && type.fields && typeComposer.addFields(type.fields));
  } // TODO: ELSE
};

export interface IMethods {
  createTypes: (
    typeDef: ObjectTypeComposerAsObjectDefinition<any, any>,
  ) => void;
}

/**
 *
 *
 * @param pluginExports @{any[]} The named exports from other plugins
 * @param schemaComposer
 */
export const generatePluginTypes = async (
  pluginExports: any[] = [],
  schemaComposer: SchemaComposer<any>,
) => {
  const pluginFieldExtensions: {
    [key in string]: ObjectTypeComposerAsObjectDefinition<any, any>;
  } = {};

  pluginExports.forEach(pluginExport => {
    const fn: (methods: IMethods) => void = pluginExport.customizeSchema; // Plugin exports `customizeSchema` ?
    const methods: IMethods = {
      createTypes: typeDef => {
        pluginFieldExtensions[typeDef.name] = typeDef;
      },
    };

    void (isFunction(fn) && fn(methods));
  });

  Array.from(
    (schemaComposer.values() as unknown) as Iterable<NamedTypeComposer<any>>,
  ).forEach(typeComposer =>
    processType({
      schemaComposer,
      typeComposer,
      pluginFieldExtensions,
    }),
  );
};
