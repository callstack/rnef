import fs, { existsSync } from "node:fs";
import path from "node:path";
import{ color, logger, spinner } from "@rnef/tools";

export async function copyHermes({
  iosDir,
  destinationDir
}: { iosDir: string, destinationDir: string }) {
  const loader = spinner();


  loader.start(`Copying ${color.bold('hermes.xcframework')}`)
  const hermesDestination = path.join(
    destinationDir, 'hermes.xcframework'
  );

  if (existsSync(hermesDestination)) {
    logger.debug(`Removing old hermes copy`)
    await fs.promises.rm(hermesDestination, { recursive: true, force: true });
  }

  await fs.promises.cp(
    path.join(
      iosDir,
      'Pods',
      'hermes-engine',
      'destroot',
      'Library',
      'Frameworks',
      'universal',
      'hermes.xcframework'
    )
    ,
    path.join(
      destinationDir, 'hermes.xcframework'
    ),
    {
      recursive: true,
      force: true
    }
  )

  loader.stop(`Copied ${color.bold('hermes.xcframework')}`)
}
