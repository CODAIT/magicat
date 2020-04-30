const fs = require('fs')
const path = require('path')
const { logError } = require('./logger.js')
const { labels } = require('./segmenter.js')

// https://en.wikipedia.org/wiki/List_of_file_signatures
const fileSignatures = [
  [0xFF, 0xD8, 0xFF], // jpg
  [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // png
  [0x47, 0x49, 0x46], // gif
  [0x42, 0x4D] // bmp
]

// Returns the object name lower-cased and allows for commonly used synonyms
const normalizeObjectArgument = function (objName) {
  let name = objName.toLowerCase()
  switch (name) {
    case 'bg':
    case 'backdrop':
      name = 'background'
      break
    case 'plane':
    case 'aeroplane':
      name = 'airplane'
      break
    case 'bike':
      name = 'bicycle'
      break
    case 'ship':
      name = 'boat'
      break
    case 'automobile':
      name = 'car'
      break
    case 'table':
      name = 'dining table'
      break
    case 'motorcycle':
      name = 'motorbike'
      break
    case 'human':
    case 'people':
    case 'persons':
      name = 'person'
      break
    case 'plant':
    case 'houseplant':
      name = 'potted plant'
      break
    case 'couch':
      name = 'sofa'
      break
    case 'television':
    case 'tele':
    case 't.v.':
      name = 'tv'
      break
  }
  return name
}

// Returns a Promise that resolves to an array of file paths to images found in absoluteDirPath
const getDirectoryListing = function (absoluteDirPath) {
  console.log(`scanning for images in directory '${absoluteDirPath}' ...`)

  return new Promise((resolve, reject) => {
    fs.readdir(absoluteDirPath, async (err, files) => {
      if (err) {
        reject(new Error(`failed to read directory '${absoluteDirPath}'`))
      } else {
        const imgFiles = []

        for (let i = 0; i < files.length; i++) {
          const fName = path.join(absoluteDirPath, files[i])
          try {
            if (await isImageFile(fName)) {
              imgFiles.push(fName)
            }
          } catch (e) {
            logError(e)
          }
        }

        console.log(`found ${imgFiles.length || '0'} image${imgFiles.length === 1 ? '' : 's'} in directory '${absoluteDirPath}'`)
        resolve(imgFiles)
      }
    })
  })
}

// Returns a Promise that resolves to true if absoluteFilePath is an image
const isImageFile = function (absoluteFilePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(absoluteFilePath, (err, fileData) => {
      if (err) {
        reject(new Error(`failed to read file '${absoluteFilePath}'`))
      } else {
        const isImage = fileSignatures.some((signature, index) => {
          for (let i = 0; i < signature.length; i++) {
            if (signature[i] !== fileData[i]) {
              return false
            }
          }
          return true
        })

        resolve(isImage)
      }
    })
  })
}

/**
 * Returns the normalized name of the objectOption
 */
const parseObjectOption = function (objectOption) {
  let argValue = (objectOption === true) ? null : objectOption
  if (argValue) {
    argValue = normalizeObjectArgument(argValue)
    if (!labels.find(l => l === argValue)) {
      throw new Error(`[${objectOption}] is not a valid object.`)
    }
  }
  return argValue
}

/**
 * Returns a Promise that resolves to an array of absolute image file paths
 */
const parsePathArgument = function (pathArg) {
  if (pathArg.search(/https?:/) === 0) {
    // skipping http(s) requests
    return Promise.resolve([pathArg])
  }

  const p = path.resolve(pathArg)
  return new Promise((resolve, reject) => {
    fs.lstat(p, (err, stats) => {
      if (err) {
        reject(new Error(err))
      } else if (stats.isDirectory()) {
        return getDirectoryListing(p)
          .then(resolve)
          .catch(reject)
      } else if (stats.isFile()) {
        isImageFile(p)
          .then(isImage => {
            if (isImage) {
              resolve(p)
            } else {
              reject(new Error(`'${p}' is not an image file`))
            }
          })
          .catch(reject)
      } else {
        reject(new Error(`'${p}' is not a file or a directory`))
      }
    })
  })
}

/**
 * Returns a Promise that resolves the absolute file path of imagePath
 */
const parseImagePath = function (imagePath) {
  if (imagePath.search(/https?:/) === 0) {
    // skipping http(s) requests
    return Promise.resolve(imagePath)
  }
  const f = path.resolve(imagePath)
  return new Promise((resolve, reject) => {
    fs.lstat(f, (err, stats) => {
      if (err) {
        reject(new Error(err))
      } else if (!stats.isFile()) {
        reject(new Error(`'${f}' is not an image file`))
      } else {
        isImageFile(f)
          .then(isImage => {
            if (isImage) {
              resolve(f)
            } else {
              reject(new Error(`'${f}' is not an image file`))
            }
          })
          .catch(reject)
      }
    })
  })
}

module.exports = {
  parseObjectOption: parseObjectOption,
  parsePathArgument: parsePathArgument,
  parseImagePath: parseImagePath
}
