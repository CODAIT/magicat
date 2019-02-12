const commandLineUsage = require('command-line-usage')

exports.showHelpScreen = () => {
  const sections = [
    {
      header: '🧙 😺 magicat',
      content: 'A Deep Learning powered CLI utility for identifying the contents of image files. Your very own command-line crystal ball 🔮.'
    },
    {
      header: 'Synopsis',
      content: [
        '$ magicat <file> [--{bold command}]',
        '$ magicat <directory> [--{bold command}]',
        '$ magicat [--{bold help} | -{bold h}]'
      ]
    },
    {
      header: 'Command List',
      content: [
        { name: '{bold save} {underline object}', summary: "Save the specfied object to it's own file. Also works with 'all'." },
        { name: '{bold remove} {underline object}', summary: "Save a copy of the image with the specfied object (or background) removed. Supports aliases 'bg' and 'BG'." },
        { name: '{bold show} {underline object}', summary: "Show the specified object (or the entire image if blank) in the terminal." },
        { name: '{bold contains} {underline object} [--{bold verbose}]', summary: "Returns list of images containing the specified object." },
        { name: ' ', summary: "(Use --verbose option to see all results)." },
      ]
    },
    {
      header: 'Examples',
      content: [
        {
          desc: '1. Examine objects contained in an image. ',
          example: '$ magicat path/to/IMAGE.PNG'
        },
        {
          desc: "2. Show the 'dining table' from sample.jpg. ",
          example: `$ magicat sample.jpg --show 'dining table'`
        },
        {
          desc: "3. Scan the 'pets' directory for images containing a dog. ",
          example: '$ magicat pets/ --contains Dog'
        },
        {
          desc: "4. Remove the background from all images in the current directory. ",
          example: '$ magicat . --remove BG'
        }
      ]
    },
    {
      header: 'Detectable Objects',
      content: [
        {
          desc: '1. Airplane',
          example: '11. Dining Table'
        },
        {
          desc: "2. Bicycle",
          example: '12. Dog'
        },
        {
          desc: "3. Bird",
          example: '13. Horse'
        },
        {
          desc: "4. Boat",
          example: '14. Motorbike'
        },
        {
          desc: "5. Bottle",
          example: '15. Person'
        },
        {
          desc: '6. Bus',
          example: '16. Potted Plant'
        },
        {
          desc: "7. Car",
          example: '17. Sheep'
        },
        {
          desc: "8. Cat",
          example: '18. Sofa'
        },
        {
          desc: "9. Chair",
          example: '19. Train'
        },
        {
          desc: "10. Cow",
          example: '20. TV'
        }        
      ]
    },    
    { 
      content: '{bold Project home}: {underline https://github.com/CODAIT/magicat}' 
    },
    { 
      content: 'Built using an open-source deep learning model from the {bold Model Asset eXchange}: {underline https://developer.ibm.com/exchanges/models}' 
    }
  ]
  console.log(commandLineUsage(sections))
}