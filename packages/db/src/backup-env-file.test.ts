import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/**
 * `env_value` في deploy/backup/envfile.sh يقرأ deploy/.env كما يقرؤه docker compose، ويرفض ما يختلف
 * تفسيره بينهما برسالة (docs/BACKUP.md §7). bash وحده، بلا قاعدة ولا restic.
 */
const LIB = fileURLToPath(new URL("../../../deploy/backup/lib.sh", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "masar-envfile-"));
const file = join(dir, ".env");

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function read(content: string, key: string) {
  writeFileSync(file, content);
  const result = spawnSync(
    "bash",
    ["-c", `set -euo pipefail; . "${LIB}"; env_value "$1"`, "_", key],
    {
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        BACKUP_RUNTIME: "compose",
        MASAR_ENV_FILE: file,
      },
      encoding: "utf8",
    },
  );
  return { status: result.status, value: result.stdout, error: result.stderr };
}

describe("env_value: قراءة deploy/.env كما يقرؤها compose", () => {
  it("القيمة الصريحة، وexport، والتعليق بعد مسافة، والمسافات، وآخر سطر يغلب", () => {
    expect(read("A=plain\n", "A").value).toBe("plain");
    expect(read("export A=exported\n", "A").value).toBe("exported");
    expect(read("A=value # تعليق\n", "A").value).toBe("value");
    expect(read("A=a#b\n", "A").value).toBe("a#b");
    expect(read("A =  spaced  \n", "A").value).toBe("spaced");
    expect(read("A=first\nA=second\n", "A").value).toBe("second");
    expect(read("AB=other\n", "A").value).toBe("");
  });

  it("التنصيص المفرد حرفي ولو فيه $ و#، والمزدوج بلا $", () => {
    expect(read("A='p$ss #1'\n", "A").value).toBe("p$ss #1");
    expect(read('A="s3:https://s3.x/b"\n', "A").value).toBe("s3:https://s3.x/b");
  });

  it("ما يوسّعه compose ($ بلا تنصيص مفرد) أو تنصيص بلا إغلاق: رفض برسالة", () => {
    for (const line of ["A=pa$ss\n", 'A="pa$ss"\n', 'A="a\\nb"\n', "A='open\n"]) {
      const result = read(line, "A");
      expect(result.status, line).not.toBe(0);
      expect(result.error).toContain("deploy/.env");
    }
  });
});
