* **JOLOKIA_OFF** : If set disables activation of Jolokia (i.e. echos an empty value). By default, Jolokia is enabled. 
* **JOLOKIA_CONFIG** : If set uses this file (including path) as Jolokia JVM agent properties (as described 
  in Jolokia's [reference manual](http://www.jolokia.org/reference/html/agents.html#agents-jvm)). 
  By default this is `/opt/jolokia/jolokia.properties`. If this file exists, it be will taken 
  as configuration and **any other config options are ignored**.  
* **JOLOKIA_HOST** : Host address to bind to (Default: 0.0.0.0)
* **JOLOKIA_PORT** : Port to use (Default: 8778)
* **JOLOKIA_USER** : User for authentication. By default authentication is switched off.
* **JOLOKIA_PASSWORD** : Password for authentication. By default authentication is switched off.
* **JOLOKIA_ID** : Agent ID to use (`$HOSTNAME` by default, which is the container id)
* **JOLOKIA_OPTS**  : Additional options to be appended to the agent opts. They should be given in the format 
  "key=value,key=value,..."

Some options for integration in various environments

* **JOLOKIA_AUTH_OPENSHIFT** : Switch on OAuth2 authentication for OpenShift. The value of this parameter must be the OpenShift API's 
  base URL (e.g. `https://localhost:8443/osapi/v1beta3/`)