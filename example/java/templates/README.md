## Java Image with Jolokia

This image is based on the official [java](https://registry.hub.docker.com/_/java) image and 
includes a Jolokia JVM agent. The agent is installed as `/opt/jolokia/jolokia.jar`. 

In order to enable Jolokia for your application you should use this 
image as a base image (via `FROM`) and use the output of `jolokia_opts` in 
your startup scripts to include it in your startup options. 

For example, the following snippet can be added to a script starting up your 
Java application

    # ...
    export JAVA_OPTIONS="$JAVA_OPTIONS $(jolokia_opts)"
    # .... us JAVA_OPTIONS when starting your app, e.g. as Tomcat does

You can influence the behaviour `jolokia_opts` by setting various environment 
variables:

{{= fp.block('config-vars') }}

So, if you start the container with `docker run -e JOLOKIA_OFF ...` no agent will be launched.

### Startup Script /run-java.sh

The default command for this image is `/run-java.sh`. Its purpose it
to fire up Java applications which are provided as fat-jars, including
all dependencies or more classical from a main class, where the
classpath is build up from all jars within a directory.x1

{{= fp.block('run-java-sh','readme',{ 'fp-no-files' : true }) }}

The following versions are used:

{{= fp.block('readme-footer') }}