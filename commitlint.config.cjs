/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        // the resource is small enough that these keep history readable
        'scope-enum': [
            2,
            'always',
            ['client', 'server', 'ui', 'build', 'deps', 'docs', 'ci', 'repo'],
        ],
        'header-max-length': [2, 'always', 100],
    },
};
