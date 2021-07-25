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
import { ObjectBuilder } from '../field-parser';
import { fieldMerger } from '../merger/field-merger';

export interface ModuleOptions {
  logger: Logger;
  config: Config;
}

export async function createModule(
  options: ModuleOptions,
  build: NextCatalogBuild,
): Promise<GraphQLModule> {
  const { entitiesCatalog } = build;

  const {
    entities: UNSTABLE_catalogEntities,
  } = await entitiesCatalog.entities();

  const mergedObj = fieldMerger(...UNSTABLE_catalogEntities);

  const EntitiesTC = new ObjectBuilder({
    name: 'Entity',
    obj: mergedObj,
  }).build();

  EntitiesTC.addResolver({
    kind: 'query',
    name: 'findMany',
    args: {
      skip: 'Int',
      limit: 'Int',
    },
    type: [EntitiesTC],
    resolve: async () => {
      const { entities } = await entitiesCatalog.entities();
      return entities;
    },
  });

  schemaComposer.Query.addFields({
    entities: EntitiesTC.getResolver('findMany'),
  });

  const schema = schemaComposer.buildSchema();

  const module = new GraphQLModule({
    extraSchemas: [schema],
    logger: options.logger as any,
  });

  return module;
}

module.hot?.accept();
