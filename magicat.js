#!/usr/bin/env node
'use strict'

const path = require('path')
const version = require(path.join(__dirname, 'package.json')).version
const commander = require('commander')
const cmdline = new commander.Command('magicat')
const { parseObjectOption, parsePathArgument, parseImagePath } = require('./lib/parser.js')
const { contains, save, remove, preview, labels } = require('./lib/segmenter.js')
const { logError, logSummary } = require('./lib/logger.js')

// Run the specified action (contains, save, remove) with inputPath and objectArg
const doAction = async function (inputPath, objectArg, action, outputArg) {
  const results = []
  try {
    const objectName = parseObjectOption(objectArg)
    const absoluteImagePaths = await parsePathArgument(inputPath)
    const absoluteImagePathsArray = Array.isArray(absoluteImagePaths) ? absoluteImagePaths : [absoluteImagePaths]

    for (let i = 0; i < absoluteImagePathsArray.length; i++) {
      const imagePath = absoluteImagePathsArray[i]
      console.log(`processing image '${imagePath}' ...`)

      let result
      if (action === 'save') {
        result = await save(imagePath, objectName, outputArg)
      } else if (action === 'remove') {
        result = await remove(imagePath, objectName, outputArg)
      } else {
        result = await contains(imagePath, objectName)
      }
      results.push(result)
    }
    logSummary(action, absoluteImagePathsArray, objectName, results)
  } catch (err) {
    logError(err, true)
  }
}

// Run the 'preview' action drawing the object from the image in the terminal
const doPreview = async function (inputPath, previewArg) {
  try {
    const obj = parseObjectOption(previewArg)
    const img = await parseImagePath(inputPath)
    await preview(img, obj)
  } catch (e) {
    logError(e, true)
  }
}

const run = function (pathOrUrl) {
  if (cmdline.preview) {
    doPreview(pathOrUrl, cmdline.preview)
  } else if (cmdline.save) {
    doAction(pathOrUrl, cmdline.save, 'save', cmdline.output)
  } else if (cmdline.remove) {
    doAction(pathOrUrl, cmdline.remove, 'remove', cmdline.output)
  } else {
    doAction(pathOrUrl, cmdline.contains, 'contains')
  }
}

let pathArgument
const description = ` A Deep Learning powered CLI utility for identifying the contents of image files.
 Argument <file|directory|url> must be an image file , a directory containing images, or a URL to an image.
 Supported image types include PNGs and JPGs.`

cmdline
  .description(description)
  .usage('<file|directory|url> [options]')
  .arguments('<file|directory|url>')
  .action(fileDir => { pathArgument = fileDir })
  .option('-c, --contains [object]', 'Output if the specified object is contained in the image. If no object is provided, list all objects contained in the image.')
  .option('-s, --save [object]', 'Extract the specified object from the image and save as a separate image. If no object is provided, save all objects found in the image.')
  .option('-r, --remove [object]', 'Save a copy of an image with the specified object removed. If no object is provided, save copies of the image with each found object removed.')
  .option('-p, --preview [object]', 'View the specified object in the terminal window. If no object is provided, view the entire image. Works only in terminals that support colors and can only be used with images not directories.')
  .option('-o, --output <directory>', 'Directory to save images. Directory must already exist. Option can be used with --save or --remove. If not used images are stored in the same directory as the input image (or current working directory for URLs).')
  .version(`\r\nmagicat v${version}\r\n`, '-v, --version')

cmdline.on('--help', () => {
  console.log('')
  console.log('Objects:')
  const mid = Math.ceil(labels.length / 2)
  // list available objects
  for (let i = 0; i < mid; i++) {
    const obj = `${labels[i]}`
    if (i + mid < labels.length) {
      console.log(`  ${obj}${obj.length < 6 ? '\t\t\t' : '\t\t'}${labels[i + mid]}`)
    } else {
      console.log(`  ${obj}`)
    }
  }
  console.log('')
  console.log('Documentation can be found at https://github.com/codait/magicat')
  console.log('')
})

cmdline.parse(process.argv)

if (pathArgument) {
  run(pathArgument)
} else {
  logError('command \'magicat <file|directory|url>\' argument missing or invalid. see --help for usage.', true)
}
