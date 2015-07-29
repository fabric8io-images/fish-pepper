FROM {{= it.config.java }}

MAINTAINER {{= it.maintainer }}

ENV JOLOKIA_VERSION {{= it.jolokiaVersion }}

# Add environment setup script
ADD jolokia_opts /bin/

RUN chmod 755 /bin/jolokia_opts && mkdir /opt/jolokia && wget {{= it.jolokiaBaseUrl}}/{{= it.jolokiaVersion}}/jolokia-jvm-{{= it.jolokiaVersion}}-agent.jar -O /opt/jolokia/jolokia.jar

# Print out the version
CMD java -jar /opt/jolokia/jolokia.jar --version
