const { promises: fs } = require('fs');
const path = require('path');

const protoRoot = path.join(__dirname, "..");

async function patchProtoFiles() {
  const walk = async function* (dir, { exts, includeFiles }) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const res = {
        path: path.join(dir, entry.name),
        name: entry.name,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
        isSymlink: entry.isSymbolicLink(),
      };
      if (res.isDirectory) {
        yield* walk(res.path, { exts, includeFiles });
      } else if (
        (includeFiles && res.isFile) ||
        (exts && exts.includes(path.extname(res.name).slice(1)))
      ) {
        yield res;
      }
    }
  };

  for await (const entry of walk(protoRoot, { exts: ['ts'], includeFiles: true })) {
    const filePath = entry.path;

    // Read the file content
    let content = await fs.readFile(filePath, 'utf-8');

    // Perform the replacement
    content = content
      .split('\n')
      .map((line) =>
        line.replace(/^(import .+? from ["']\..+?)(?<!\.ts)(["'];)$/, '$1.ts$2'),
      )
      .join('\n');

    // Write the modified content back to the file
    await fs.writeFile(filePath, content);
  }
}

// Run the function
patchProtoFiles();
