FROM debian

ENV FISH_PEPPER_VERSION 0.5.5

ADD setup_node.sh /tmp
RUN bash /tmp/setup_node.sh \
 && rm /tmp/setup_node.sh \
 && apt-get update \
 && apt-get -y install nodejs make git  \
 && npm config set unsafe-perm true \
 && npm -g install fish-pepper@${FISH_PEPPER_VERSION} \
 && mkdir /fp

VOLUME /fp
WORKDIR /fp

ENTRYPOINT [ "fish-pepper" ]
