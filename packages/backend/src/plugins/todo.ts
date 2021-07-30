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
import { CatalogClient } from '@backstage/catalog-client';
import {
  createRouter,
  TodoReaderService,
  TodoScmReader,
} from '@backstage/plugin-todo-backend';
import { Router } from 'express';
import { IMethods } from '@backstage/plugin-catalog-graphql';
import { PluginEnvironment } from '../types';
import { Entity, ENTITY_DEFAULT_NAMESPACE } from '@backstage/catalog-model';
import { GraphQLJSONObject } from 'graphql-compose';

const customizeSchema = (todoService: TodoReaderService) => {
  return (methods: IMethods) => {
    const { createTypes } = methods;

    // Updates Entity, adds `todos` field
    // It currently just updates an existing Entity, TODO: Create new entities
    createTypes({
      name: 'Entity',
      fields: {
        todos: {
          type: [GraphQLJSONObject],
          resolve: async (entity: Entity, args, { token }) => {
            return (
              await todoService.listTodos(
                {
                  entity: {
                    kind: entity.kind,
                    namespace:
                      entity.metadata.namespace || ENTITY_DEFAULT_NAMESPACE,
                    name: entity.metadata.name,
                  },
                },
                {
                  token,
                },
              )
            ).items;
          },
        },
      },
    });
  };
};

export default async function createPlugin({
  logger,
  reader,
  config,
  discovery,
}: PluginEnvironment): Promise<{
  graphql: { customizeSchema: (methods: IMethods) => void };
  router: Router;
}> {
  const todoReader = TodoScmReader.fromConfig(config, {
    logger,
    reader,
  });
  const catalogClient = new CatalogClient({ discoveryApi: discovery });
  const todoService = new TodoReaderService({
    todoReader,
    catalogClient,
  });

  return {
    graphql: { customizeSchema: customizeSchema(todoService) },
    router: await createRouter({ todoService }),
  };
}
