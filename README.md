## 🧙😺 `magicat`
### _Deep learning magic.. with the convenience of `cat`!_

A Deep Learning powered CLI utility.

Install using `npm` to automatically add the `magicat` command to your PATH.

```
npm install -g magicat
```

That's it! 

Now you can begin using `magicat` like your very own command-line crystal ball 🔮 to identify what objects are contained in an image.

## Basic Commands

> For more detailed usage information, see the in-app help page which can be accessed by executing `magicat -h`

Use the basic command `magicat <image_name>` to identify what objects are contained in an image. If you have multiple images you'd like to inspect, you can also provide the name of a directory containing image files.

![basic usage](assets/basic-usage.gif)


To scan a directory of images for a certain object, use the `--contains` command. When used in combination with the `--verbose` option, the results for all images in a directory will be displayed. 

![contains usage](assets/magicat-contains-demo.gif)


If you'd like to see an in-terminal preview of any of these objects, use the `--show` flag, followed by the name of the object you'd like to see. You can specify the 'colormap' to see all the objects highlighted within the original image.

![object preview](assets/show-preview.png)
_Object preview made possible thanks to @sindresorhus and [`terminal-image`](https://github.com/sindresorhus/terminal-image)_


To save any of the objects as individual image files, use the `--save` flag, followed by the name of the object you'd like to save, or use 'all' to save all objects.

![saving objects](assets/save-demo.gif)