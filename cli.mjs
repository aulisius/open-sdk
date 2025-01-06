#!/usr/bin/env node
// @ts-check
import { createClient, parseSpecFile } from "@faizaanceg/open-sdk";
import { log } from "node:console";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { argv, cwd, exit } from "node:process";

const SUPPORTED_LANGUAGES = ["java", "php", "typescript"];

let Manifest = {
  name: "OpenSDK",
  subcommands: {
    generate: {
      description: "Generate SDK",
      options: {
        "--output": {
          shortFlag: "-o",
          description: "Output directory for the code",
          get defaultValue() {
            throw new Error("Please provide output directory.");
          },
          takesValue: true,
          validate(value) {
            return existsSync(join(cwd(), value));
          },
        },
        "--dry-run": {
          shortFlag: null,
          description: "Do not create files.",
          get defaultValue() {
            return false;
          },
          takesValue: false,
          validate(value) {},
        },
        "--language": {
          shortFlag: "-L",
          description: `Specify language to use. Allowed options are (${SUPPORTED_LANGUAGES.join(
            "|"
          )})`,
          get defaultValue() {
            throw new Error("Please provide a language.");
          },
          takesValue: true,
          validate(value) {
            if (!["java", "php", "typescript"].includes(value?.toLowerCase())) {
              throw new Error(
                `Language "${value}" not supported. Allowed languages are ${SUPPORTED_LANGUAGES.join(
                  ", "
                )}`
              );
            }
          },
        },
        "--spec": {
          shortFlag: "-S",
          description: "Path to the OpenAPI 3.1 JSON file",
          get defaultValue() {
            throw new Error("Please provide valid path to JSON spec file.");
          },
          takesValue: true,
          validate(value) {
            if (!existsSync(join(cwd(), value))) {
              throw new Error("Spec file not found at " + value);
            }
          },
        },
      },
    },
  },
};

let [subcommand = "help", ...args] = argv.slice(2);

function parseOptions(subcommand, args) {
  let options = Manifest.subcommands[subcommand].options;
  let validFlags = Object.entries(options)
    .flatMap(([option, details]) => [option, details.shortFlag])
    .filter(Boolean);
  let expandFlags = Object.fromEntries(
    Object.entries(options).map(([option, details]) => [
      details.shortFlag,
      option,
    ])
  );
  let parsed = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!validFlags.includes(arg)) {
      throw new Error("UnknownOption: " + arg);
    }
    let flag = expandFlags[arg] ?? arg;
    if (options[flag].takesValue) {
      const value = args[i + 1];
      options[flag].validate(value);
      parsed[flag] = value;
      i++;
    } else {
      parsed[flag] = true;
    }
  }
  for (let [flag, details] of Object.entries(options)) {
    if (parsed[flag] === undefined) {
      parsed[flag] = details.defaultValue;
    }
  }
  return parsed;
}

switch (subcommand) {
  case "generate":
    {
      try {
        let options = parseOptions(subcommand, args);
        log(options);
        let spec = parseSpecFile(
          resolve(join(process.cwd(), options["--spec"]))
        );
        createClient(
          spec,
          resolve(join(process.cwd(), options["--output"])),
          options["--language"].toLowerCase()
        );
      } catch (error) {
        console.error(
          error.message +
            " Please use `opensdk help` to understand the correct usage",
          error
        );
        exit(1);
      }
    }
    break;
  case "help": {
    console.log(`${Manifest.name} ${Manifest.version}
usage: opensdk <command> [<flags>]

Subcommands available
${Object.entries(Manifest.subcommands).map(
  ([subcommand, info]) => `\t${subcommand}\t${info.description}`
)}

Subcommand Options

${Object.entries(Manifest.subcommands).map(
  ([subcommand, info]) =>
    `${subcommand}\n${Object.entries(info.options)
      .map(
        ([option, details]) =>
          `\t${option}${details.shortFlag ? ", " + details.shortFlag : ""}\t${
            details.description
          }`
      )
      .join("\n")}`
)}
`);
    break;
  }
  default:
    console.error("Unknown command :" + subcommand);
    exit(1);
}
