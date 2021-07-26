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
import { schemaComposer, InputTypeComposer } from 'graphql-compose';

import { NextCatalogBuild } from '@backstage/plugin-catalog-backend';
import { ObjectBuilder } from '../field-builder';
import { fieldMerger } from '../merger/field-merger';
import { filterToSift } from '../field-builder/filters';
import { isNumber } from 'lodash';

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

  const EntitiesBuilder = new ObjectBuilder({
    name: 'Entity',
    obj: mergedObj,
  });

  const EntitiesTC = EntitiesBuilder.getOTC();

  EntitiesTC.addResolver({
    kind: 'query',
    name: 'findMany',
    args: {
      filter: ObjectBuilder.getFilterArgs({
        itc: EntitiesTC.getInputTypeComposer(),
      }),
      skip: 'Int',
      limit: 'Int',
    },
    type: [EntitiesTC],
    resolve: async ({ args }) => {
      // Ideally we would convert all of this into a DB query instead of grabbing everything.
      const { entities } = await entitiesCatalog.entities();

      const { filter, limit = -1, skip = 0 } = args;

      const result = filter ? entities.filter(filterToSift(filter)) : entities;

      if (result.length === 0) return result;

      if (limit >= 0) {
        return result.slice(skip, skip + limit);
      }
      return result;
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
