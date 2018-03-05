#!/usr/bin/env bash

export test_to_run
export service_to_start
export options_to_use
export command_to_use

test_to_launch=$1
debug_mode=$2
exit_instruction="--exit-code-from test"

if [ "$debug_mode" = "alive" ]; then
  exit_instruction=""
fi

function launch_test {
  local test_name=$1
  service_to_start=$2
  command_to_use=$3
  options_to_use=$4
  test_to_run=$5

  if [ ! $test_to_launch ] || [ "$test_to_launch" = "$test_name" ]; then
    echo "Launching integration test \"${test_name}\""
    docker-compose up --build ${exit_instruction}
  fi
}

launch_test "start" "start" "node" "basic" "basics"

rm -rf .config_volume/.domapic || sudo rm -rf .config_volume/.domapic
launch_test "log-level" "start" "node" "log-level" "tracer"
