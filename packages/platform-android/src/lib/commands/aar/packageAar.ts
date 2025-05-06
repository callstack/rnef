import { outro } from '@rnef/tools';
import { runGradleAar } from '../runGradle.js';
import { toPascalCase } from '../toPascalCase.js';

export interface AarProject {
  sourceDir: string;
  moduleName: string;
}

export type PackageAarFlags = {
  variant: string;
  moduleName?: string;
};

export async function packageAar(
  aarProject: AarProject,
  args: PackageAarFlags
) {
  normalizeArgs(args);

  const tasks = [`assemble${toPascalCase(args.variant)}`];

  await runGradleAar({ tasks, aarProject, variant: args.variant });
  outro('Success 🎉.');
}

export async function localPublishAar(
  aarProject: AarProject,
  args: PackageAarFlags
) {
  const tasks = ['publishToMavenLocal'];

  await runGradleAar({
    tasks,
    aarProject,
    variant: args.variant,
    isPublishTask: true,
  });
  outro('Success 🎉.');
}

function normalizeArgs(args: PackageAarFlags) {
  if (!args.variant) {
    args.variant = 'debug';
  }
}

export const options = [
  {
    name: '--variant <string>',
    description:
      "Specify your app's build variant, which is constructed from build type and product flavor, e.g. 'debug' or 'freeRelease'.",
  },
  {
    name: '--module-name <string>',
    description: 'AAR module name',
  },
];
