const crypto = require('crypto')
const fs = require('fs');
const https = require('https');
const path = require('path');

function sha256() {
    return crypto.createHash('sha256');
}

function processHosts(content) {
    const date = new Date().toISOString().slice(0, 10);
    let str = `# Generated by hosts-converter.js (teppyboy/domain-list-community)
# Source: {source}
# SHA256: {sha256}
# Last converted: ${date}

`;
    const lines = content.split("\n");
    for (let [_, v] of lines.entries()) {
        if (v.startsWith("0.0.0.0") || v.startsWith("127.0.0.1")) {
            v = v.split(" ")[1];
        }
        else if (!v.startsWith("#") && v.length > 0) {
            continue;
        }
        str += v + "\n";
    }    
    return str;
}

function convertDir(dir, outDir) {
    var files = fs.readdirSync(dir);
    for (let [_, file] of files.entries()) {
        const fullPath = path.join(dir, file);
        const filePath = path.parse(file);
        if (filePath.ext !== ".txt") {
            continue;
        }
        const outName = `category-${filePath.name.toLowerCase()}`;
        const outPath = path.join(outDir, outName);
        fs.readFile(fullPath, (_, data) => {
            const content = data.toString("utf-8");
            const contentHash = sha256().update(content).digest('hex');
            function convert() {
                let converted = processHosts(content);
                converted = converted.replace("{source}", fullPath);
                converted = converted.replace("{sha256}", contentHash);
                fs.writeFileSync(outPath, converted);
                console.log(`Converted ${fullPath} to ${outName}`);
            }
            let process = true;
            try {
                const oldContent = fs.readFileSync(outPath, "utf8");
                const oldContentHash = oldContent.split("\n")[2].split(" ")[2];
                if (oldContentHash === contentHash) {
                    console.log(`${file} is up to date.`);
                    process = false;
                }
            }
            catch (e) {
                console.error(e);
            }
            finally {
                if (process) {
                    convert();
                }
            }
        })
    }
}

function convertUrl(name, url, outDir) {
    const hostsUrl = new URL(url);
    const options = {
        hostname: hostsUrl.host,
        port: 443,
        path: hostsUrl.pathname + hostsUrl.search,
        method: 'GET',
    };
    https.request(options, res => {
        if (res.statusCode !== 200) {
            console.error(`Hosts ${url} return code is not 200.`);
            return;
        }
        let data = '';
        res.on('data', chunk => {
            data += chunk;
        });
        res.on('end', () => {
            const content = data.toString("utf-8");
            const contentHash = sha256().update(content).digest('hex');
            const outName = `category-${name.toLowerCase()}`;
            const outPath = path.join(outDir, outName);
            function convert() {
                let converted = processHosts(content);
                converted = converted.replace("{source}", url);
                converted = converted.replace("{sha256}", contentHash);
                fs.writeFileSync(outPath, converted);
                console.log(`Converted ${url} to ${outName}`);
            }
            let process = true;
            try {
                const oldContent = fs.readFileSync(outPath, "utf8");
                const oldContentHash = oldContent.split("\n")[2].split(" ")[2];
                if (oldContentHash === contentHash) {
                    console.log(`${url} is up to date.`);
                    process = false;
                }
            }
            catch (e) {
                console.error(e);
            }
            finally {
                if (process) {
                    convert();
                }
            }
        });
    }).end();
}

function readConfig(configFile) {
    if (!fs.existsSync(configFile)) {
        console.error(`${configFile} does not exist.`);
        return;
    }
    const list = JSON.parse(fs.readFileSync(configFile, "utf8"));
    return list;
}

function main() {
    const config = readConfig("hosts-list.json");
    if (config == null) {
        console.error("Quittng due to config file not available.");
        return;
    }
    for (let [_, v] of config.entries()) {
        console.log(`Converting hosts ${v.name} (type "${v.type}")`);
        switch(v.type) {
            case "dir":
                convertDir(v.hosts, "data");
                break;
            case "url":
                convertUrl(v.name, v.hosts, "data");
                break;
        }
    }
}

main()