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

import { fieldMerger } from './field-merger';

describe('Merger', () => {
  it('should merge all the objects', () => {
    const a = {
      a: 1,
    };

    const b = {
      b: 1,
      foo: {
        bar: {
          blah: true,
        },
      },
    };
    const c = {
      c: 1,
      foo: {
        bar: {
          meh: true,
        },
      },
    };

    expect(fieldMerger(a, b, c)).toEqual({
      a: 1,
      b: 1,
      c: 1,
      foo: {
        bar: {
          meh: true,
          blah: true,
        },
      },
    });
  });

  it('merges arrays', () => {
    expect(fieldMerger({ a: [1, 2] }, { a: [1, 3, 4] })).toEqual({
      a: [1, 2, 1, 3, 4],
    });
  });

  describe('on different types', () => {
    it('number & string > keeps string', () => {
      expect(
        fieldMerger(
          {
            a: 1,
          },
          {
            a: 'foo',
          },
          {
            a: 1,
          },
        ),
      ).toEqual({ a: 'foo' });
    });
    it('boolean & string > keeps string', () => {
      expect(
        fieldMerger(
          {
            a: true,
          },
          {
            a: 'foo',
          },
          {
            a: true,
          },
        ),
      ).toEqual({ a: 'foo' });
    });
    it('boolean & number > keeps number', () => {
      expect(
        fieldMerger(
          {
            a: true,
          },
          {
            a: 1,
          },
          {
            a: true,
          },
        ),
      ).toEqual({ a: 1 });
    });
  });
});
