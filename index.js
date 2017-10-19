/**
 * @file webpack-concat-plugin
 * @author tpphu
 */
const fs = require('fs');
const UglifyJS = require('uglify-js');
const md5 = require('md5');
const path = require('path');

class ConcatPlugin {
    constructor(options) {
        this.settings = options;

        // used to determine if we should emit files during compiler emit event
        this.startTime = Date.now();
        this.prevTimestamps = {};
        this.filesToConcatAbsolute = options.filesToConcat
            .map(f => path.resolve(f));
    }

    getFileName(files, filePath = this.settings.fileName) {
        const fileRegExp = /\[name\]/;
        const hashRegExp = /\[hash\]/;

        if (this.settings.useHash || hashRegExp.test(filePath)) {
            const fileMd5 = this.md5File(files);

            if (!hashRegExp.test(filePath)) {
                filePath = filePath.replace(/\.js$/, '.[hash].js');
            }
            filePath = filePath.replace(hashRegExp, fileMd5.slice(0, 20));
        }
        return filePath.replace(fileRegExp, this.settings.name);
    }

    md5File(files) {
        if (this.fileMd5) {
            return this.fileMd5;
        }
        const content = Object.keys(files)
            .reduce((fileContent, fileName) => (fileContent + files[fileName]), '');

        this.fileMd5 = md5(content);
        return this.fileMd5;
    }

    apply(compiler) {
        const self = this;
        let content = '';
        const concatPromise = () => self.settings.filesToConcat.map(fileName =>
            new Promise((resolve, reject) => {
                fs.readFile(fileName, (err, data) => {
                    if (err) {
                        throw err;
                    }
                    resolve({
                        [fileName]: data.toString()
                    });
                });
            })
        );

        compiler.plugin('done', (stats) => {
            var compilation = stats.compilation;

            Promise.all(concatPromise()).then(files => {
                const allFiles = files.reduce((file1, file2) => Object.assign(file1, file2));
                self.settings.fileName = self.getFileName(allFiles);

                if (process.env.NODE_ENV === 'production' || self.settings.uglify) {
                    let options = {
                        fromString: true
                    };

                    if (typeof self.settings.uglify === 'object') {
                        options = Object.assign({}, self.settings.uglify, options);
                    }

                    const result = UglifyJS.minify(allFiles, options);

                    content = result.code;
                }
                else {
                    content = Object.keys(allFiles)
                        .map(fileName => allFiles[fileName])
                        .reduce((content1, content2) => (`${content1}\n${content2}`), '');
                }
                fs.writeFileSync(path.join(compilation.options.output.path, self.settings.fileName), content);
            });
        });
    }
}

module.exports = ConcatPlugin;
