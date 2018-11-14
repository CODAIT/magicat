#!/usr/bin/env node
'use strict'

// suppress TensorFlow 'extended instruction set' warning
process.env['TF_CPP_MIN_LOG_LEVEL'] = 2

require('@tensorflow/tfjs-node')
const tf = require('@tensorflow/tfjs')
const fs = require('fs')
const terminalImage = require('terminal-image')
const argv = require('yargs').argv
const jimp = require('jimp')
const { createCanvas, Image } = require('canvas')
const canvas = createCanvas(513, 513)
const ctx = canvas.getContext('2d')
const userInput = argv._[0]

const MODEL_PATH = 'file://' + __dirname + '/model/tensorflowjs_model.pb'
const WEIGHTS_PATH = 'file://' + __dirname + '/model/weights_manifest.json'

const OBJ_LIST = ['background', 'airplane', 'bicycle', 'bird', 'boat', 
'bottle', 'bus', 'car', 'cat', 'chair', 'cow', 'dining table', 
'dog', 'horse', 'motorbike', 'person', 'potted plant', 'sheep', 
'sofa', 'train', 'tv']
let objMap = {} 
OBJ_LIST.forEach((x,i)=> objMap[x]=i)
const OBJ_MAP = objMap

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
const getColor = pixel => COLOR_LIST[pixel - 1]

const URLtoB64 = dataURL => dataURL.split(',')[1]

const isImageFile = userInput => {
  const imgTypes = ['bmp', 'gif', 'jpg', 'jpeg', 'png']
  try {
    return fs.lstatSync(userInput).isFile() 
      && userInput.split('.').length > 1 
      && imgTypes.indexOf(userInput.split('.').slice(-1)[0]) !== -1
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

const parsePrediction = modelOutput => {
  const objIDs = [...new Set(modelOutput)] // eslint-disable-next-line
  const objPixels = modelOutput.reduce((a, b) => (a[OBJ_LIST[b]] = ++a[OBJ_LIST[b]] || 1, a), {})
  const objTypes = objIDs.map(x => OBJ_LIST[x])
  return {
    foundSegments: objTypes.concat('colormap'),
    response: {
      objectTypes: objTypes,
      objectIDs: objIDs,
      objectPixels: objPixels,
      flatSegMap: modelOutput
    }
  }
}

const cropSegment = (segmentName, modelJSON) => {
  return new Promise((resolve, reject) => {
    const data = modelJSON.data
    let img = new Image()
    let imageURL
    img.onload = () => {
      try {
        const flatSegMap = modelJSON.response.flatSegMap
        ctx.drawImage(img, 0, 0, img.width, img.height)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        const data = imageData.data
        if (segmentName === 'colormap') {
          for (let i = 0; i < data.length; i += 4) {
            const segMapPixel = flatSegMap[i / 4]
            let objColor = [0, 0, 0]
            if (segMapPixel) {
              objColor = getColor(modelJSON.response.objectIDs.indexOf(segMapPixel))
              data[i]   = objColor[0]  // red channel
              data[i+1] = objColor[1]  // green channel
              data[i+2] = objColor[2]  // blue channel
              data[i+3] = 200          // alpha
            }
          }
        } else { 
          for (let i = 0; i < data.length; i += 4) {
            const segMapPixel = flatSegMap[i / 4]
            if (segMapPixel !== OBJ_MAP[segmentName]) {
              data[i+3] = 0           // alpha
            }
          }
        }
        ctx.putImageData(imageData, 0, 0)      
        imageURL = canvas.toDataURL()
        resolve(URLtoB64(imageURL))
      } catch (e) {
        reject(`${ e } - image load error`)
      }
    }
    img.src = data
  })
}

const saveSegment = async (fileName, segName, modelJSON) => {
  const outputName = `${ fileName.split('.')[0] }-${ segName }.png`
  console.log(`saved ${ outputName }`)
  fs.writeFileSync(outputName, Buffer.from(await cropSegment(segName, modelJSON), 'base64'))
  return null
}

const getPrediction = fileName => {
  return new Promise(async (resolve, reject) => {
    try {
      if (isImageFile(fileName)) {
        const data = await jimp.read(`${ process.cwd() }/${ fileName }`)
        const scaledImage = await data.scaleToFit(513, 513).getBufferAsync(jimp.MIME_PNG)
        try {
          const img = new Image()
          img.onload = async () => await ctx.drawImage(img, 0, 0)
          img.onerror = err => { throw err }
          img.src = scaledImage
          const myTensor = tf.fromPixels(canvas).expandDims()   
          const model = await tf.loadFrozenModel(MODEL_PATH, WEIGHTS_PATH)
          resolve({ 
            ...parsePrediction(
            Array.from(
            model.predict(myTensor).dataSync())), 
            data: scaledImage
          })
        } catch (e) {
          reject(`error processing image - ${ e }`)
        }
      }
    } catch(e) {
      reject(`error preprocessing image - ${ e }`)
    }
  })  
}

const processImage = async fileName => {
  try {    
    const modelJSON = await getPrediction(fileName)
    
    if (!argv.show || (argv.show !== true && modelJSON.foundSegments.indexOf(argv.show) === -1)) {
      console.log(`The image '${ fileName }' contains the following segments: ${ modelJSON.response.objectTypes.join(', ') }.`)
    } else if (argv.show === true) { 
      (async () => console.log(await terminalImage.buffer(Buffer.from(modelJSON.data))))()
    } else if (argv.show !== true) {
      (async () => console.log(await terminalImage.buffer(Buffer.from(await cropSegment(argv.show, modelJSON), 'base64'))))()
    } 

    if (argv.show === true || (argv.show && modelJSON.foundSegments.indexOf(argv.show) === -1)) {
      console.log(`\nAfter the --show flag, provide an object name from the list above, or 'colormap' to view the highlighted object colormap.`)
    }

    if (argv.save) {
      if (argv.save === 'all') {
        modelJSON.foundSegments.forEach(seg => {
          saveSegment(fileName, seg, modelJSON)
        })
      } else if (argv.save !== true && modelJSON.foundSegments.indexOf(argv.save) !== -1) {
        saveSegment(fileName, argv.save, modelJSON)
      } else {
        console.log(`\nAfter the --save flag, provide an object name from the list above, or 'all' to save each segment individually.`)
      }
    }
  } catch (e) {
    console.error(`error processing image ${ fileName } - ${ e }`)
  }
}

const processDirectory = async dirName => {
  console.log(`Scanning directory ${ dirName }...`)
  let cleanDirName
  if (dirName.substr(-1) === '/') {
    cleanDirName = dirName.substr(0, dirName.length - 1)
  } else {
    cleanDirName = dirName
  }

  const contents = fs.readdirSync(cleanDirName)
  contents.map(async file => {
    try {
      const modelJSON = await getPrediction(cleanDirName + '/' + file)
      console.log(`The image '${ file }' contains the following segments: ${ modelJSON.response.objectTypes.join(', ') }.`)
    } catch (e) {
      console.log(`error processing directory ${ cleanDirName } - ${ e }`)
    }
  })
}

const handleInput = async input => {
  if (isImageFile(input)) { 
    processImage(input)
  } else if (isDirectory(input)) {
    await processDirectory(input)
  } else {
    console.error(`Invalid input. Please specify an image file or directory.`)
  }
} 

handleInput(userInput)