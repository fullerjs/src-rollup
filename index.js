'use strict';
const path = require('path');
const Transform = require('stream').Transform;
const Material = require('fuller-material-file');

const rollup = require('rollup');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');

const Tool = function(fuller, options) {
  fuller.bind(this);
  this.src = options.src;
  this.dst = options.dst;
  this.format = options.format || 'iife'; // defult is a self-executing function, suitable for inclusion as a <script> tag.
};

Tool.prototype = {
  build: function(src, dst) {
    const next = new Transform({
      objectMode: true,
      transform: (mat, enc, cb) => cb(null, mat)
    });

    const srcfile = path.join(this.src, src);
    process.nextTick(() =>
      this.createSrc(srcfile, dst)
        .then(({ code }) => this.createMaterial(srcfile, dst, code))
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
  },

  createSrc: function(src, dst) {
    return rollup
      .rollup({
        input: src,
        plugins: [
          resolve(),
          commonjs()
        ]
      })
      .then(bundle => {
        bundle.modules.forEach(module => this.addDependencies(module.id, dst))
        return bundle.generate({
          format: this.format
        });
      })
  },

  createMaterial: function(src, dst, content) {
    return new Material({
      id: dst,
      path: src
    })
      .dst(path.join(this.dst, dst))
      .error(err => this.error(err))
      .setContent(content)
  }
};


module.exports = Tool;
