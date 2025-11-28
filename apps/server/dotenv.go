package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

func UpdateEnvVars(filepath string) {
	file, err := os.Open(filepath)
	if err != nil {
		fmt.Println("error: failed to read from env file")
		return
	}

	defer file.Close()

	scanner := bufio.NewScanner(file)
	var i int = 0
	for scanner.Scan() {
		i++
		line := scanner.Text()
		strings := strings.Split(line, "=")
		if len(strings) > 2 {
			fmt.Printf("error: .env file line (%d) couldn't be processed", i)
			return
		}
		os.Setenv(strings[0], strings[1])
	}

	fmt.Println(".env file updated")
}

func GetEnvVar(key string) string {
	return os.Getenv(key)
}
