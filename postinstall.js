const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const zlib = require("zlib");
const zip = require("adm-zip");

function getDownloadLink(assets) {
  const platform = "windows";
  const arch = "x86_64";

  const data = assets.find((el) =>
    new RegExp(`.*${arch}.*${platform}.*`).test(el.name)
  );
  if (data && data.browser_download_url) {
    return data.browser_download_url;
  } else throw new Error("Platform not supported");
}

function unarch(filepath) {
  const subPath = path.basename(filepath).replace(path.extname(filepath), "");
  const z = new zip(filepath);
  z.extractEntryTo(`${subPath}/watchexec.exe`, "./bin", false, true);
  fs.unlinkSync(filepath);
}

function downloadBinary(urlStr) {
  const url = new URL(urlStr);
  const tmp = path.join(os.tmpdir(), url.pathname);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  const stream = new fs.createWriteStream(tmp, { flags: "w" });

  const download = (url) => {
    return new Promise((resolve, reject) => {
      https.get(
        url,
        {
          headers: {
            "User-Agent": "node-watchexec",
          },
        },
        (res) => {
          if (res.statusCode === 302 && res.headers.location != null) {
            download(new URL(res.headers.location)).then(resolve).catch(reject);
            return;
          }
          res
            .on("error", (err) => {
              stream.destroy();
              fs.unlink(tmp, () => reject(err));
            })
            .on("end", () => {
              stream.end();
              resolve(tmp);
            })
            .pipe(stream);
        }
      );
    });
  };
  return download(url);
}

function getLastRelease() {
  return new Promise((resolve, reject) => {
    https.get(
      "https://api.github.com/repos/watchexec/watchexec/releases/latest",
      {
        headers: {
          "User-Agent": "node-watchexec",
        },
      },
      (res) => {
        let result = "";
        res.on("data", (chunk) => {
          result += chunk;
        });
        res.on("end", () => {
          resolve(JSON.parse(result).assets);
        });
      }
    );
  });
}
getLastRelease().then(getDownloadLink).then(downloadBinary).then(unarch);
