// Checks the published type declarations the way a TypeScript user gets
// them: packs the package (prepack generates types/), installs the tarball in
// a temporary project with its dependencies only (and @types/express, for
// test/types/consumer.ts to use the middleware in Express), then type-checks
// test/types/consumer.ts and every published declaration file, strict and
// without skipLibCheck.
//
//   npm run types:test
//   npm run types:test -- <tarball>   A tarball already packed (the release
//                                     checks the one it publishes)
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');

function run(command, args, cwd) {
  try {
    return execFileSync(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
      .toString()
      .trim();
  } catch (err) {
    // What the command printed (tsc reports errors on stdout), then which
    // step failed
    if (err.stdout && err.stdout.length) {
      process.stderr.write(err.stdout);
    }
    console.error(`\`${command} ${args.join(' ')}\` failed`);
    throw err;
  }
}

// The versions the package is developed with
function version(name) {
  return JSON.parse(
    fs.readFileSync(
      path.join(root, 'node_modules', name, 'package.json'),
      'utf8'
    )
  ).version;
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'express-logger-types-'));
  try {
    const given = process.argv[2];
    const tarball = given
      ? path.resolve(given)
      : `./${run('npm', ['pack', '--silent', '--pack-destination', tmp], root)
          .split('\n')
          .pop()}`;
    fs.writeFileSync(
      path.join(tmp, 'package.json'),
      `${JSON.stringify({ name: 'consumer', private: true }, null, 2)}\n`
    );
    run(
      'npm',
      [
        'install',
        '--no-audit',
        '--no-fund',
        '--ignore-scripts',
        tarball,
        `typescript@${version('typescript')}`,
        `@types/node@${version('@types/node')}`,
        // For consumer.ts only: the declarations need no @types package
        `@types/express@${version('@types/express')}`,
      ],
      tmp
    );
    fs.copyFileSync(
      path.join(root, 'test', 'types', 'consumer.ts'),
      path.join(tmp, 'consumer.ts')
    );
    fs.writeFileSync(
      path.join(tmp, 'tsconfig.json'),
      `${JSON.stringify(
        {
          compilerOptions: {
            noEmit: true,
            strict: true,
            module: 'nodenext',
            moduleResolution: 'nodenext',
            target: 'es2023',
            lib: ['es2023'],
            types: ['node'],
            skipLibCheck: false,
          },
          include: [
            'consumer.ts',
            'node_modules/@hyperwatch/express-logger/types/**/*.d.ts',
          ],
        },
        null,
        2
      )}\n`
    );
    run(
      path.join(tmp, 'node_modules', '.bin', 'tsc'),
      ['-p', '.', '--pretty', 'false'],
      tmp
    );
    console.log('The published declarations type-check.');
  } catch (err) {
    process.exitCode = 1;
    if (err.status === undefined) {
      console.error(err);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
