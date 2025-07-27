import json
import os
import sys
import time

import requests


def download_files(url, output_dir, output_name):
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36'}
    full_output_path = os.path.join(output_dir, output_name)

    try:
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()
        with open(full_output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Downloaded '{output_name}' successfully.")
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error downloading '{output_name}': {e} (URL: {url})")
    except requests.exceptions.ConnectionError as e:
        print(f"Connection Error downloading '{output_name}': {e} (URL: {url})")
    except requests.exceptions.Timeout as e:
        print(f"Timeout Error downloading '{output_name}': {e} (URL: {url})")
    except requests.exceptions.RequestException as e:
        print(f"General Request Error downloading '{output_name}': {e} (URL: {url})")
    except IOError as e:
        print(f"I/O Error saving file '{output_name}': {e}")
    except Exception as e: # Catch any other unexpected errors
        print(f"An unexpected error occurred for '{output_name}': {e}")



if __name__ == "__main__":

    json_filepath = "libby_urls.json"
    delay_seconds = 5

    download_name = input("Enter name of audiobook (will be used for filename prefix): ")
    if not download_name:
        print("Prefix cannot be empty. Using 'audiobook'.")
        download_name = "audiobook"

    output_directory = input("Enter name for the output directory (will be used for folder holding files): ")
    if not output_directory:
        print("Output directory name cannot be empty. Using 'downloads'.")
        output_directory = "downloads"
    os.makedirs(output_directory, exist_ok=True)


    # Loading URLs from Libby extension
    try:
        with open(json_filepath, "r", encoding='utf-8') as f: # Specify encoding
            content_urls = json.load(f)
    except FileNotFoundError:
        print(f"Error: JSON file '{json_filepath}' not found.")
        sys.exit(1) # Exit if the input file isn't found
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{json_filepath}'. Is it valid JSON?")
        sys.exit(1) # Exit if JSON is malformed

    print(f"Found {len(content_urls)} URLs to download.")

    for index, url in enumerate(content_urls):
        full_filename = download_name + f"_{index:03d}" + ".mp3"
        download_files(url, output_directory, full_filename)
        if index < len(content_urls) - 1: # Don't sleep after the last download
            time.sleep(delay_seconds)

    print("Finished all downloads! Be very careful about overuse of this tool, caution is king here.")
