import { outro } from '@rnef/tools';
import { runGradleAar } from '../runGradle.js';
import type { AarProject } from './packageAar.js';

export async function publishLocalAar(aarProject: AarProject) {
  const tasks = ['publishToMavenLocal'];

  await runGradleAar({
    tasks,
    aarProject,
    // @todo - figure out better typeZ
    variant: '',
    isPublishTask: true,
  });
  outro('Success 🎉.');
}

export const options = [
  {
    name: '--module-name <string>',
    description: 'AAR module name',
  },
];
