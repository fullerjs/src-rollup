'use strict';
const path = require('path');
const Transform = require('stream').Transform;
const Material = require('fuller-material-file');

const rollup = require('rollup');
const replace = require('rollup-plugin-replace');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');

class Tool {
  constructor(fuller, options) {
    fuller.bind(this);
    this.src = options.src;
    this.dst = options.dst;
    this.replace = options.replace;
    this.format = options.format || 'iife'; // defult is a self-executing function, suitable for inclusion as a <script> tag.
  }

  build(src, dst) {
    const next = new Transform({
      objectMode: true,
      transform: (mat, enc, cb) => cb(null, mat)
    });

    const srcfile = path.join(this.src, src);
    process.nextTick(() =>
      this.createSrc(srcfile, dst)
        .then(({ output }) => this.createMaterials(srcfile, dst, output))
        .then(mat => {
          next.write(mat);
          next.end();
        })
        .catch(err => this.error(err.loc ? {
          message: err.message,
          file: err.loc.file,
          line: err.loc.line,
          column: err.loc.column,
          extract: err.frame
        } : err))
    );

    return next;
  }

  createSrc(src, dst) {
    return rollup
      .rollup({
        input: src,
        plugins: [
          this.replace && replace(this.replace),
          resolve(),
          commonjs()
        ]
      })
      .then(bundle => {
        this.addDependencies(bundle.watchFiles, dst);
        return bundle.generate({
          format: this.format
        });
      })
  }

  createMaterials(srcfile, dst, output) {
    // fuller doesn't support multiple files in one stream yet
    for (const chunk of output) {
      switch (chunk.type) {
        case 'asset':
          continue;

        case 'chunk':
          return this.createMaterial(srcfile, dst, chunk.code);
      }
    }
  }

  createMaterial(src, dst, content) {
    return new Material({
      id: dst,
      path: src
    })
      .dst(path.join(this.dst, dst))
      .error(err => this.error(err))
      .setContent(content)
  }
}

module.exports = Tool;
