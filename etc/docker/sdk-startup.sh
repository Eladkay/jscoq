#!/bin/bash

PKGS=(
libgmp10:i386 libc6-i386
wget ca-certificates
)

if [ ! -e $HOME/.sdk-startup ] ; then
dpkg --add-architecture i386
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -yq ${PKGS[@]}

touch $HOME/.sdk-startup
fi

exec "${@:-bash}"
