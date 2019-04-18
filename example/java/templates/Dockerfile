FROM {{= fp.config.version.java + fp.config.type.extension }}
{{= fp.block("qemu-lib-" + fp.param.arch,'commands',{'fp-bin-files' : true}) || ''}}

MAINTAINER {{= fp.maintainer }}

ENV JOLOKIA_VERSION {{= fp.jolokiaVersion }}

# Add environment setup script
ADD jolokia_opts /bin/

RUN chmod 755 /bin/jolokia_opts \
 && mkdir /opt/jolokia \
 && wget {{= fp.jolokiaBaseUrl}}/{{= fp.jolokiaVersion}}/jolokia-jvm-{{= fp.jolokiaVersion}}-agent.jar -O /opt/jolokia/jolokia.jar

{{= fp.block('run-java-sh','copy',{ dest: "/" }) }}

# Print out the version by default
CMD java -jar /opt/jolokia/jolokia.jar --version
