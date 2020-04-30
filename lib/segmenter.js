const fs = require('fs')
const path = require('path')
const { predict, labelsMap } = require('@codait/max-image-segmenter')
const { createCanvas, loadImage } = require('canvas')
const maxvis = require('@codait/max-vis')
const terminalImage = require('terminal-image')
const { logSummary, logError } = require('./logger.js')

const labels = labelsMap.map(l => l.toLowerCase())

// Returns a Canvas element with the image drawn onto it
const getImageCanvas = async function (imageInput) {
  const img = await loadImage(imageInput)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return canvas
}

// Returns the prediction for the image filtered by the object
const getObjectPrediction = async function (img, obj) {
  if (!img) {
    throw new Error('image was not provided')
  }

  const canvas = await getImageCanvas(img)
  const prediction = await predict(canvas)

  let objs = null
  if (obj) {
    objs = prediction.objectsDetected.filter(o => o.toLowerCase() === obj.toLowerCase())
  } else {
    objs = prediction.objectsDetected
  }

  return {
    objects: objs,
    prediction: prediction
  }
}

// Returns an image with the segment removed or just just the segment by itself
const extractSegment = async function (img, segmentId, remove) {
  const objPred = await getObjectPrediction(img, segmentId)
  const objects = objPred.objects

  if (objects && objects.length) {
    const prediction = objPred.prediction
    const segments = objects.map(o => labels.indexOf(o))

    const options = {
      type: 'segments',
      segments: segments,
      exclude: !!remove
    }

    const maxVisReponse = await maxvis.extract(prediction, img, options)
    return maxVisReponse
  } else {
    return []
  }
}

// Returns the location to save file
const getSavePath = function (imgPath, outputPath, suffix) {
  let savePath = outputPath ? path.resolve(outputPath) : path.parse(imgPath).dir
  if (imgPath.search(/https?:/) === 0) {
    let origName = path.parse(imgPath).name
    if (origName.indexOf('?') > -1) {
      origName = origName.substring(0, origName.indexOf('?'))
    }
    if (origName.indexOf('#') > -1) {
      origName = origName.substring(0, origName.indexOf('#'))
    }
    const newName = `${origName}_${suffix}.png`
    savePath = path.join(savePath, newName)
  } else {
    const origName = path.parse(imgPath).name
    const newName = `${origName}_${suffix}.png`
    savePath = path.join(savePath, newName)
  }
  return savePath
}

// Save the image segemnts
const saveImageSegments = async function (img, imageSegments, outputPath, remove) {
  if (imageSegments && imageSegments.length) {
    return imageSegments.map((segment, index) => {
      // i.e., image_person-1.png, image_no-background-0.png
      const imgName = getSavePath(img, outputPath, `${index < 10 ? ('0' + index) : index}-${remove ? 'no-' : ''}${labelsMap[segment.label]}`)
      let saved = false

      try {
        fs.writeFileSync(imgName, segment.image)
        saved = true
      } catch (e) {
        saved = e.message || e
      }

      return {
        status: saved === true ? (remove ? 'removed' : 'saved') : 'failed',
        segment: labelsMap[segment.label],
        output: saved === true ? imgName : saved
      }
    })
  }
}

// Preview the image segment in the terminal
const previewImageSegments = function (imageSegments) {
  if (imageSegments && imageSegments.length) {
    imageSegments.forEach(async (segment, index) => {
      await terminalImage.buffer(segment.image)
        .then(console.log)
        .catch(logError)
    })
  }
}

// Preview the image from endpoint in the terminal
const previewUrlImage = function (endpoint) {
  const client = endpoint.startsWith('https') ? require('https') : require('http')
  client.get(endpoint, res => {
    const data = []
    res.on('data', chunk => {
      data.push(chunk)
    })
    res.on('end', () => {
      const imageBuffer = Buffer.concat(data)
      terminalImage.buffer(imageBuffer)
        .then(console.log)
        .catch(logError)
    })
  }).on('error', err => {
    logError(err, true)
  })
}

/**
 * Returns a promise that resolves to an array of objects contained in imgPath filtered by obj
 */
const contains = async function (imgPath, obj) {
  const objPred = await getObjectPrediction(imgPath, obj)
  const objects = objPred.objects

  if (objects && objects.length) {
    return Array.isArray(objects) ? objects : [objects]
  } else {
    return []
  }
}

/**
 * Returns a promise that resolves to an array of objects with status, segment, and output of saved img obj
 */
const save = async function (img, obj, out) {
  const segments = await extractSegment(img, obj)
  if (segments) {
    const savedImgs = await saveImageSegments(img, segments, out)

    if (savedImgs && savedImgs.length) {
      return savedImgs
    }
  }

  return []
}

/**
 * Returns a promise that resolves to an array of objects with status, segment, and output of saved img obj
 */
const remove = async function (img, obj, out) {
  const segments = await extractSegment(img, obj, true)
  if (segments) {
    const removedImgs = await saveImageSegments(img, segments, out, true)

    if (removedImgs && removedImgs.length) {
      return removedImgs
    }
  }

  return []
}

/**
 * Draws the object from the image in the terminal
 */
const preview = async function (img, obj) {
  if (obj) {
    const segments = await extractSegment(img, obj)

    if (segments && segments.length) {
      previewImageSegments(segments)
    } else {
      logSummary('preview', img, obj, [])
    }
  } else if (img.search(/https?:/) === 0) {
    previewUrlImage(img)
  } else {
    terminalImage.file(img)
      .then(console.log)
      .catch(logError)
  }
}

module.exports = {
  contains: contains,
  save: save,
  remove: remove,
  preview: preview,
  labels: labels
}
