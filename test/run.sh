#!/usr/bin/env bash

export test_type
export test_to_run
export service_to_start
export command_to_use
export options_to_use

# This options are defined from command line with the "--option" format
integration=false
end_to_end=false
develop=false
build=false

# Internally used configurations. They change depending of the command line options
log_sep="--------"
compose_build_option=""
compose_options="-f docker-compose.yml"
compose_up_options="--exit-code-from test"
unique_test_to_launch=false

function getOption {
  local  __resultvar=$1
  local  option=$2
  if [ "$3" = "$option" ] || [ "$4" = "$option" ] || [ "$5" = "$option" ] || [ "$6" = "$option" ]; then
    eval $__resultvar="true"
  fi
}

function getTestToLaunch {
  if [ $1 ] && [[ ! "$1" =~ ^-- ]]; then
    unique_test_to_launch=$1
  fi
}

function setConfig {
  if [ $integration = false ] && [ $end_to_end = false ]; then
    integration=true
    end_to_end=true
  fi

  if [ $develop = true ]; then
    compose_options="-f docker-compose.yml -f docker-compose-develop.yml"
    compose_up_options=""
  fi

  if [ $build = true ]; then
    compose_build_option="--build"
  fi

  echo $log_sep
  echo "Run integration tests: $integration"
  echo "Run end-to-end tests: $end_to_end"
  echo "Unique test to launch: $unique_test_to_launch"
  echo "Rebuild docker images: $build"
  echo "Start docker with --develop config: $develop"
  echo $log_sep
}

function down_docker_volumes {
  cd docker
  docker-compose down --volumes
  cd ..
}

function launch_test {
  test_to_run=$1
  service_to_start=$2
  command_to_use=$3
  options_to_use=$4

  if [ $unique_test_to_launch = false ] || [ "$unique_test_to_launch" = "$test_to_run" ]; then
    echo $log_sep
    echo "Launching ${test_type} test \"${test_to_run}\""
    echo $log_sep
    cd docker
    set -e
    docker-compose ${compose_options} up ${compose_build_option} ${compose_up_options}
    cd ..
  fi
}

function copy_service_install {
  if [ $build = true ] && [ -d ./services/install ]; then
    # Ensure that temporary folder for docker services dependencies installation exists
    if [ ! -d ./docker/service/.install ]; then
      mkdir ./docker/service/.install
    fi
    # Execute custom pre-install script. (Intended to be used for copying needed dependencies to docker installation path)
    if [ -f ./services/install/pre-install.sh ]; then
      cd ./services/install
      ./pre-install.sh
      cd ../../
    fi
    # Copy install script to docker. (Will be runned in docker build, for installing needed service dependencies)
    if [ -f ./services/install/install.sh ]; then
      cp ./services/install/install.sh ./docker/service/.install/install.sh
    fi
  fi
}

getTestToLaunch "$1"
getTestToLaunch "$2"
getTestToLaunch "$3"
getTestToLaunch "$4"
getTestToLaunch "$5"
getTestToLaunch "$6"
getOption integration "--integration" "$1" "$2" "$3" "$4" "$5" "$6"
getOption end_to_end "--end-to-end" "$1" "$2" "$3" "$4" "$5" "$6"
getOption develop "--develop" "$1" "$2" "$3" "$4" "$5" "$6"
getOption build "--build" "$1" "$2" "$3" "$4" "$5" "$6"
setConfig
copy_service_install
down_docker_volumes

if [ $integration = true ]; then
  test_type="integration"
  source "./${test_type}/run.sh"
fi
if [ $end_to_end = true ]; then
  test_type="end-to-end"
  source "./${test_type}/run.sh"
fi