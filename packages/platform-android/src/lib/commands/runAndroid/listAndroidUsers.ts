import { promptSelect, spawn, spinner } from '@rnef/tools';
import { getAdbPath } from './adb.js';

type User = {
  id: string;
  name: string;
};

const regex = new RegExp(
  /^\s*UserInfo\{(?<userId>\d+):(?<userName>.*):(?<userFlags>[0-9a-f]*)}/
);

export async function checkUsers(device: string): Promise<User[]> {
  const adbPath = getAdbPath();
  const adbArgs = ['-s', device, 'shell', 'pm', 'list', 'users'];
  const loader = spinner();
  loader.start(`Checking users on the device`);

  try {
    const { stdout, stderr } = await spawn(adbPath, adbArgs, { stdio: 'pipe' });

    if (stderr) {
      loader.stop(`Failed to check users on the device. ${stderr}`, 1);
      return [];
    }

    const lines = stdout.split('\n');
    const users = [];

    for (const line of lines) {
      const res = regex.exec(line);
      if (res?.groups) {
        users.push({ id: res.groups['userId'], name: res.groups['userName'] });
      }
    }

    loader.stop(`Found ${users.length} users on the device.`);
    return users;
  } catch (error) {
    loader.stop(
      `Unexpected error while checking users on the device. Continuing without user selection. Error details: ${
        (error as { message: string }).message
      }.`,
      1
    );
    return [];
  }
}

export async function promptForUser(deviceId: string) {
  const users = await checkUsers(deviceId);
  if (users.length > 1) {
    const selectedUser = await promptSelect({
      message: 'Which user profile would you like to launch your app into?',
      options: users.map((user) => ({
        label: user.name,
        value: user,
      })),
    });

    return selectedUser;
  }

  return null;
}
