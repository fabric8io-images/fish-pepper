# fish-pepper - Spicing up the ocean

This is a small Docker image ( ~ 30MB) for [fish-pepper](https://github.com/rhuss/fish-pepper) a  
build system for docker images. 

This image can be use if [node.js](http://nodejs.org) is not installed locally.

Call this image with 

    docker run -it --rm -v `pwd`:/fp fabric8/fish-pepper 
    
This is best packed into an alias

    alias fish-pepper="docker run -it --rm  -v `pwd`:/fp fabric8/fish-pepper"
    
and then call it with
  
    fish-pepper -h
    
Please note that you must be in the directory where the main configuration file `fish-pepper.yml` is located. For 
communicating with the Docker daemon when using the option `-b` the Docker unix socket must be mounted with the option 
`-v /var/run/docker.sock:/var/run/docker.sock`


For  more fluid usage of the command line too it is recommended to install fish-pepper locally with 

    npm install -g fish-pepper
    
However, in that case you must have node.js installed locally.
