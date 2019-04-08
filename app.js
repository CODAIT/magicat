#!/usr/bin/env node
'use strict'

// suppress TensorFlow 'extended instruction set' warning
process.env['TF_CPP_MIN_LOG_LEVEL'] = 2

const fs = require('fs')
const terminalImage = require('terminal-image')
const jimp = require('jimp')
const { showHelpScreen } = require('./lib.js')
const { createCanvas, Image } = require('canvas')

const { predict, labelsMap } = require('@codait/max-image-segmenter')

const commander = require('commander')
const program = new commander.Command('magicat')
  .usage(`<file|directory> [command]`)
program.on('--help', showHelpScreen)
program.parse(process.argv)

const argv = require('yargs')
  .coerce('contains', opt => opt ? opt.toLowerCase() : opt)
  .coerce('remove', opt => opt ? opt.toLowerCase() : opt)
  .coerce('save', opt => opt ? opt.toLowerCase() : opt)
  .coerce('show', opt => typeof opt === String ? opt.toLowerCase() : opt)
  .argv
const userInput = argv._[0]
const re = /[^.\/].*/

// allow for commonly mistyped objects
for (let item in argv) {
  if (argv[item] == 'people' || argv[item] == 'human')
    argv[item] = 'person'
}

const COLOR_MAP = {
  green: [0, 128, 0],
  red: [255, 0, 0],
  blue: [0, 0, 255],
  purple: [160, 32, 240],
  pink: [255, 185, 80],
  teal: [0, 128, 128],
  yellow: [255, 255, 0],
  gray: [192, 192, 192]
}
const COLOR_LIST = Object.values(COLOR_MAP)

let canvas
let ctx

const getColor = pixel => COLOR_LIST[pixel % COLOR_LIST.length]

const URLtoB64 = dataURL => dataURL.split(',')[1]

const containsObject = (objName, modelJSON) => modelJSON.foundObjects.indexOf(objName) !== -1

const isImageFile = userInput => {
  const imgTypes = ['bmp', 'gif', 'jpg', 'jpeg', 'png']
  try {
    return userInput.split('.').length > 1 
      && imgTypes.indexOf(userInput.toLowerCase().split('.').slice(-1)[0]) !== -1
  } catch(e) {
    return false
  }
}

const isDirectory = userInput => {
  try {
    return fs.lstatSync(userInput).isDirectory()
  } catch(e) {
    return false
  }
}

const objectFilter = (objName, modelJSON) => {
  if (containsObject(objName, modelJSON)) {
    console.log(`\n${ objName.substr(0, 1).toUpperCase() + objName.substr(1) } found in '${ process.cwd() }/${ modelJSON.fileName }'.`)
    process.exit(0)
  } else {
    if (argv.verbose === true) {
      console.log(`\n${ objName.substr(0, 1).toUpperCase() + objName.substr(1) } not found in '${ process.cwd() }/${ modelJSON.fileName }'.`)
    }
    process.exit(1)    
  }
}

const flatten = function (a) {
  return Array.isArray(a) ? [].concat(...a.map(flatten)) : a
}

const parsePrediction = prediction => {
  const flatSegMap = flatten(prediction.segmentationMap)
  const objTypes = prediction.objectsDetected
  const objIDs = objTypes.map(o => labelsMap.indexOf(o))
  return {
    foundObjects: objTypes.concat('colormap'),
    response: {
      objectTypes: objTypes,
      objectIDs: objIDs,
      flatSegMap: flatSegMap
    }
  }
}

const cropObject = (objectName, modelJSON, method = 'crop') => {
  return new Promise((resolve, reject) => {
    const data = modelJSON.data
    let img = new Image()
    let imageURL
    img.onload = () => {
      try {
        const flatSegMap = modelJSON.response.flatSegMap
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0, img.width, img.height)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        const data = imageData.data
        if (method === 'crop') {
          if (objectName === 'colormap') {
            let objColor = [0, 0, 0]
            flatSegMap.forEach((s, i) => {
              if (s !== labelsMap.indexOf('background')) {
                objColor = getColor(s)
                data[(i * 4)] = objColor[0] // red channel
                data[(i * 4) + 1] = objColor[1] // green channel
                data[(i * 4) + 2] = objColor[2] // blue channel
                data[(i * 4) + 3] = 200 // alpha
              }
            })
          } else {
            flatSegMap.forEach((s, i) => {
              if (s !== labelsMap.indexOf(objectName)) {
                data[(i * 4) + 3] = 0 // alpha
              }
            })
          }
        } else if (method === 'remove') {
          flatSegMap.forEach((s, i) => {
            if (s === labelsMap.indexOf(objectName)) {
              data[(i * 4) + 3] = 0 // alpha
            }
          })
        }
        ctx.putImageData(imageData, 0, 0)      
        imageURL = canvas.toDataURL()
        resolve(URLtoB64(imageURL))
      } catch (e) {
        reject(`Image load ${ e }`)
      }
    }
    img.src = data
  })
}

const doSave = async (objName, modelJSON) => {
  let outputName = ''
  if (modelJSON.fileName[0] != '.') {
    outputName = `${ modelJSON.fileName.split('.')[0] }-${ objName }.png`
  } else {
    const cleanFileName = modelJSON.fileName.match(re)
    const noExt = String(cleanFileName).split('.').slice(0,-1)
    outputName = `${ noExt }-${ objName }.png`
  }
  console.log(`Saved ${ outputName.split('/').slice(-1)[0] }`)
  fs.writeFileSync(`${ process.cwd() }/${ outputName.split('/').slice(-1)[0] }`, Buffer.from(await cropObject(objName, modelJSON), 'base64'))
}

const doRemove = async (objName, modelJSON) => {
  let outputName = ''
  if (modelJSON.fileName[0] != '.') {
    outputName = `${ modelJSON.fileName.split('.')[0] }-no-${ objName }.png`
  } else {
    const cleanFileName = modelJSON.fileName.match(re)
    const noExt = String(cleanFileName).split('.').slice(0,-1)
    outputName = `${ noExt }-no-${ objName }.png`
  }
  console.log(`Saved ${ outputName.split('/').slice(-1)[0] }`)
  fs.writeFileSync(`${ process.cwd() }/${ outputName.split('/').slice(-1)[0] }`, Buffer.from(await cropObject(objName, modelJSON, 'remove'), 'base64'))
}

const saveObject = async (objName, modelJSON, isDirScan = false) => {
  if (objName === 'all') {
    modelJSON.foundObjects.forEach(async obj => {
      await doSave(obj, modelJSON)
    })
  } else if (argv.save !== true && modelJSON.foundObjects.indexOf(argv.save) !== -1) {
    await doSave(objName, modelJSON)
  } else if (argv.save !== true && modelJSON.foundObjects.indexOf(argv.save) == -1 && isDirScan) {
    console.log(objName.substr(0, 1).toUpperCase() + objName.substr(1) + ' not found in this image.')
  } else {
    console.log(`\n'${ objName.substr(0, 1).toUpperCase() + objName.substr(1) }' not found. ` + 
      `After the --save flag, provide an object name from the list above, or 'all' to save each segment individually.`)
  }
  return null
}

const removeObject = async (objRaw, modelJSON, isDirScan = false) => {
  const objName = objRaw == 'bg' || objRaw == 'BG' ? 'background' : objRaw
  if (objName == 'all' || objName == 'colormap') {
    console.log(`After the --remove flag, please provide an object name from the list above.`)
  } else if (argv.remove !== true && modelJSON.foundObjects.indexOf(objName) !== -1) {
    await doRemove(objName, modelJSON)
  } else if (argv.remove !== true && modelJSON.foundObjects.indexOf(objName) == -1 && isDirScan) {
    console.log(objName.substr(0, 1).toUpperCase() + objName.substr(1) + ' not found in this image.')
  } else {
    console.log(`\n'${ objName.substr(0, 1).toUpperCase() + objName.substr(1) }' not found. ` + 
      `After the --remove flag, please provide an object name from the list above.`)
  }
  return null
}

const getPrediction = fileName => {
  return new Promise(async (resolve, reject) => {
    try {
      if (isImageFile(fileName)) {
        let fname = fileName[0] === '/' ? fileName : `${process.cwd()}/${fileName}`
        let data = await jimp.read(fname)
        const scaledImage = await data.scaleToFit(512, 512).getBufferAsync(jimp.MIME_PNG)
        try {
          const img = new Image()
          img.onload = async () => {
            canvas = createCanvas(img.width, img.height)
            ctx = canvas.getContext('2d')
            await ctx.drawImage(img, 0, 0)
          }
          img.onerror = err => { throw err }
          img.src = scaledImage

          resolve({
            ...parsePrediction(await predict(canvas)),
            data: scaledImage,
            fileName
          })
        } catch (e) {
          reject(`Image processing ${ e }`)
        }
      }
    } catch(e) {
      reject(`Image pre-processing ${ e }`)
    }
  })  
}

const showPreview = async (objName, modelJSON, isDirScan = false) => {
  if (objName === true) {
    console.log(await terminalImage.buffer(Buffer.from(modelJSON.data)))
  } else if (objName && objName !== true && modelJSON.foundObjects.indexOf(objName) == -1 && !isDirScan) {
    console.log(`\n'${ objName.substr(0, 1).toUpperCase() + objName.substr(1) }' not found. ` + 
      `After the --show flag, provide an object name from the list above or 'colormap' to view the highlighted object colormap.`)
  } else if (objName && objName !== true && modelJSON.foundObjects.indexOf(objName) == -1 && isDirScan) {
    console.log(objName.substr(0, 1).toUpperCase() + objName.substr(1) + ' not found in this image.')
  }
  else {
    console.log(await terminalImage.buffer(Buffer.from(await cropObject(argv.show, modelJSON), 'base64')))
  }

  if (modelJSON.foundObjects.indexOf(objName) !== -1) {
    console.log(modelJSON.fileName)
  }
}

const processImage = async fileName => {
  try {    
    const modelJSON = await getPrediction(fileName)
    if (argv.contains) {
      objectFilter(argv.contains, modelJSON)
    } else {
      console.log(`The image '${ fileName }' contains the following segments: ${ modelJSON.response.objectTypes.join(', ') }.`)
    }
    if (argv.show) {
      showPreview(argv.show, modelJSON)
    }
    if (argv.save) {
      saveObject(argv.save, modelJSON)
    }
    if (argv.remove) {
      removeObject(argv.remove, modelJSON)
    }
  } catch (e) {
    console.error(`Error processing '${ fileName }' - ${ e }`)
  }
}

const buildResponseMap = async (dirName, dirContents) => {
  return new Promise(async (resolve, reject) => {
    let responseMap = {}
    let fileName
    try {
      for (let file of dirContents) {
        fileName = file
        if (isImageFile(`${ dirName }/${ file }`)) {
          const response = await getPrediction(`${ dirName }/${ file }`)
          if (argv.contains && containsObject(argv.contains, response)) {
            responseMap[file] = response
          } else if (!argv.contains) {
            responseMap[file] = response
          }
        }
      }
    } catch (e) {
      console.error(`Error encountered with '${ fileName }' while scanning '${ dirName }/' - ${ e }`)
    }
    resolve(responseMap)
  })
}

const processDirectory = async dirname => {
  const dirName = dirname.substr(-1) === '/' ? dirname.substr(0, dirname.length - 1) : dirname
  
  let fullDirName
  if (dirName.substr(0,1) === '/') {
    fullDirName = dirName
  } else if (dirName === '.') {
    fullDirName = process.cwd()
  } else {
    fullDirName = `${ process.cwd() }/${ dirName }`
  }

  console.log(`Scanning directory '${ fullDirName }'${ argv.contains ? ` for ${ argv.contains }` : `` }...\n`)
  
  const rawContents = await fs.readdirSync(dirName)
  const responseMap = await buildResponseMap(dirName, rawContents)
  const contents = Object.keys(responseMap)
  const nonMatches = rawContents.filter(file => !contents.includes(file)).filter(file => isImageFile(file))
  if (argv.contains) {
    if (contents.length > 0) {
      console.log(`${ argv.contains.substr(0, 1).toUpperCase() + argv.contains.substr(1) } found in:\n`)
    } else {
      console.log(`No ${ argv.contains.substr(0, 1).toUpperCase() + argv.contains.substr(1) }${ argv.contains == 'bus' ? `es` : `s` } found.`)
    }
  }

  contents.forEach(async file => {
    try {
      if (argv.contains) {
        console.log(`${ fullDirName }/${ file }`)
      } else {
        console.log(`The image '${ file }' contains the following segments: ${ responseMap[file].response.objectTypes.join(', ') }.`)
      }

      if (argv.save) {
        saveObject(argv.save, responseMap[file], true)
      }
      if (argv.show) {
        showPreview(argv.show, responseMap[file], true)
      }
      if (argv.remove) {
        removeObject(argv.remove, responseMap[file], true)
      }
    } catch (e) {
      console.log(`Error processing directory '${ dirName }/' - ${ e }`)
    }
  })

  if (argv.contains && argv.verbose === true && nonMatches.length) {
    console.log(`\nNo ${ argv.contains.substr(0, 1).toUpperCase() + argv.contains.substr(1) }${ argv.contains == 'bus' ? `es` : `s` } found in:\n`)
    nonMatches.forEach(miss => {
      console.log(`${ fullDirName }/${ miss }`)
    })
  }
}

const handleInput = async input => {
  if (isImageFile(input)) { 
    processImage(input)
  } else if (isDirectory(input)) {
    processDirectory(input)
  } else if (!input || input === '-h' || input === '--help') {
    showHelpScreen()
  } else {
    console.error(`Invalid input. Please specify an image file or directory.`)
  }
} 

handleInput(userInput)