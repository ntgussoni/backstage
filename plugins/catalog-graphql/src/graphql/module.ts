/*
 * Copyright 2020 The Backstage Authors
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

import { Logger } from 'winston';
import { GraphQLModule } from '@graphql-modules/core';
import { Config } from '@backstage/config';
import { schemaComposer } from 'graphql-compose';

import { NextCatalogBuild } from '@backstage/plugin-catalog-backend';
import { fieldMerger } from '../merger/field-merger';
import { filterOutput, getFilterArgs } from '../graphql-tools/filters';
import { buildObject } from '../graphql-tools';
import { generatePluginTypes } from '../graphql-tools/generate-plugin-types';

export interface ModuleOptions {
  logger: Logger;
  config: Config;
}

export async function createModule(
  options: ModuleOptions,
  build: NextCatalogBuild,
  pluginExports: any[],
): Promise<GraphQLModule> {
  const { entitiesCatalog } = build;

  const {
    entities: UNSTABLE_catalogEntities,
  } = await entitiesCatalog.entities();

  const mergedObj = fieldMerger(...UNSTABLE_catalogEntities);

  const EntitiesOTC = buildObject({
    name: 'Entity',
    obj: mergedObj,
  });

  EntitiesOTC.addResolver({
    kind: 'query',
    name: 'findMany',
    args: {
      filter: getFilterArgs({
        itc: EntitiesOTC.getInputTypeComposer(),
      }),
      skip: 'Int',
      limit: 'Int',
    },
    type: [EntitiesOTC],
    resolve: async ({ args }: { args: any }) => {
      // Ideally we would convert all of this into a DB query instead of grabbing everything.
      const { entities } = await entitiesCatalog.entities();
      return filterOutput({ args, arr: entities });
    },
  });

  schemaComposer.Query.addFields({
    entities: EntitiesOTC.getResolver('findMany'),
  });

  await generatePluginTypes(pluginExports, schemaComposer);

  const schema = schemaComposer.buildSchema();
  const module = new GraphQLModule({
    extraSchemas: [schema],
    logger: options.logger as any,
  });

  return module;
}

module.hot?.accept();
