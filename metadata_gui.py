

import os
import re
import sys

from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3
from PyQt5.QtWidgets import (QApplication, QFileDialog, QFormLayout,
                             QHBoxLayout, QHeaderView, QLabel, QLineEdit,
                             QMessageBox, QPushButton, QTableWidget,
                             QTableWidgetItem, QVBoxLayout, QWidget)


# print(audio.pprint()) # metadata output
def add_audiobook_metadata(filepath, book_title, author, genre, year, narrator, snippet, total_parts, snippet_title_prefix="Part"):
    try:
        audio = MP3(filepath, ID3=EasyID3)
        audio.clear()

        audio["album"]=book_title
        audio["artist"] = author 
        audio["albumartist"] = author 
        audio["genre"] = genre
        audio["date"] = year
        audio["composer"] = narrator 
        audio["title"] = f"{snippet_title_prefix} {snippet}"
        audio["tracknumber"] = f"{snippet}/{total_parts}"
        audio.save()
        return True
    except Exception as e:
        print(f"Error processing {os.path.basename(filepath)}: {e}")
        return False


class AudiobookTaggerApp(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Libby Audiobook Tagger & Renamer")
        self.setGeometry(100, 100, 800, 600) # Increased size for table

        self.selected_folder = ""
        self.selected_cover_path = ""
        self.mp3_files = [] # To store list of MP3 files found

        self.init_ui()


    def init_ui(self):
        main_layout = QVBoxLayout()

        # --- Section 1: Folder Selection ---
        folder_layout = QHBoxLayout()
        self.folder_label = QLabel("Audiobook Folder:")
        self.folder_path_display = QLineEdit()
        self.folder_path_display.setReadOnly(True)
        self.browse_folder_btn = QPushButton("Browse...")
        self.browse_folder_btn.clicked.connect(self.browse_folder)

        folder_layout.addWidget(self.folder_label)
        folder_layout.addWidget(self.folder_path_display)
        folder_layout.addWidget(self.browse_folder_btn)
        main_layout.addLayout(folder_layout)

        # --- Section 2: Metadata Input ---
        metadata_form_layout = QFormLayout()
        self.book_title_input = QLineEdit()
        self.author_input = QLineEdit()
        self.narrator_input = QLineEdit()
        self.year_input = QLineEdit()
        self.genre_input = QLineEdit() # Could be multiple, comma-separated

        metadata_form_layout.addRow("Book Title (Album):", self.book_title_input)
        metadata_form_layout.addRow("Author (Artist):", self.author_input)
        metadata_form_layout.addRow("Narrator (Composer):", self.narrator_input)
        metadata_form_layout.addRow("Year (TDRC):", self.year_input)
        metadata_form_layout.addRow("Genre (TCON):", self.genre_input)
        main_layout.addLayout(metadata_form_layout)

        # --- Section 3: Cover Art Selection ---
        cover_layout = QHBoxLayout()
        self.cover_label = QLabel("Cover Image (JPG/PNG):")
        self.cover_path_display = QLineEdit()
        self.cover_path_display.setReadOnly(True)
        self.browse_cover_btn = QPushButton("Browse...")
        self.browse_cover_btn.clicked.connect(self.browse_cover)

        cover_layout.addWidget(self.cover_label)
        cover_layout.addWidget(self.cover_path_display)
        cover_layout.addWidget(self.browse_cover_btn)
        main_layout.addLayout(cover_layout)

        # --- Section 4: File Preview Table ---
        self.preview_table = QTableWidget()
        self.preview_table.setColumnCount(3) # Original Name, New Name, New Title Tag
        self.preview_table.setHorizontalHeaderLabels(["Original Filename", "New Filename", "New Title Tag"])
        self.preview_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch) # Stretch columns
        main_layout.addWidget(self.preview_table)

        # --- Section 5: Process Button and Status ---
        self.process_btn = QPushButton("Tag & Rename Files")
        self.process_btn.clicked.connect(self.process_files)
        main_layout.addWidget(self.process_btn)

        self.status_label = QLabel("Status: Awaiting folder selection.")
        main_layout.addWidget(self.status_label)

        self.setLayout(main_layout)

    def browse_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Audiobook Folder")
        if folder:
            self.selected_folder = folder
            self.folder_path_display.setText(folder)
            self.load_mp3_files()

    def browse_cover(self):
        cover_file, _ = QFileDialog.getOpenFileName(self, "Select Cover Image", "", "Image Files (*.jpg *.jpeg *.png)")
        if cover_file:
            self.selected_cover_path = cover_file
            self.cover_path_display.setText(cover_file)

    def load_mp3_files(self):
        self.mp3_files = sorted([f for f in os.listdir(self.selected_folder) if f.startswith("libby_") and f.endswith(".mp3")])
        self.mp3_files.sort(key=lambda x: int(x.split('_')[1].split('.')[0])) # Sort numerically by the libby_XXX part

        self.preview_table.setRowCount(len(self.mp3_files))
        
        # Populate table with original names
        for row, filename in enumerate(self.mp3_files):
            self.preview_table.setItem(row, 0, QTableWidgetItem(filename))
            # Clear proposed names for now, they'll be updated when metadata fields change
            self.preview_table.setItem(row, 1, QTableWidgetItem("")) 
            self.preview_table.setItem(row, 2, QTableWidgetItem(""))
        
        self.status_label.setText(f"Status: Found {len(self.mp3_files)} Libby MP3s. Ready to tag.")
        
        # Connect metadata input changes to update preview
        self.book_title_input.textChanged.connect(self.update_preview)
        self.author_input.textChanged.connect(self.update_preview)
        self.update_preview() # Initial update

    def update_preview(self):
        book_title = self.book_title_input.text().strip()
        
        total_parts = len(self.mp3_files)
        if not book_title or not self.mp3_files:
            for row in range(self.preview_table.rowCount()):
                self.preview_table.setItem(row, 1, QTableWidgetItem(""))
                self.preview_table.setItem(row, 2, QTableWidgetItem(""))
            return

        for row, original_filename in enumerate(self.mp3_files):
            part_num = row + 1 # 1-indexed for display and metadata
            
            # Generate proposed new filename
            # Pad with zeros based on total_parts for consistent sorting
            padding = len(str(total_parts))
            new_filename = f"{book_title} - Part {str(part_num).zfill(padding)}.mp3"
            
            # Generate proposed new title tag
            new_title_tag = f"Part {str(part_num).zfill(padding)}" # Default for now

            self.preview_table.setItem(row, 1, QTableWidgetItem(new_filename))
            self.preview_table.setItem(row, 2, QTableWidgetItem(new_title_tag))

    def process_files(self):
        if not self.selected_folder or not self.mp3_files:
            QMessageBox.warning(self, "Warning", "Please select an audiobook folder with Libby MP3 files first.")
            return
        if not self.book_title_input.text().strip():
            QMessageBox.warning(self, "Warning", "Please enter the Book Title.")
            return
        if not self.author_input.text().strip():
            QMessageBox.warning(self, "Warning", "Please enter the Author.")
            return

        book_title = self.book_title_input.text().strip()
        author = self.author_input.text().strip()
        narrator = self.narrator_input.text().strip()
        year = self.year_input.text().strip()
        genre = self.genre_input.text().strip()
        
        if not year: year = "Unknown" # Default for missing year
        if not genre: genre = "Audiobook" # Default for missing genre

        total_parts = len(self.mp3_files)
        processed_count = 0
        self.status_label.setText("Status: Processing files...")
        QApplication.processEvents() # Update GUI immediately

        # Create a dictionary to map old full paths to new full paths
        rename_map = {}
        for row, original_filename in enumerate(self.mp3_files):
            original_filepath = os.path.join(self.selected_folder, original_filename)
            
            part_num = row + 1
            padding = len(str(total_parts))
            new_filename = f"{book_title} - Part {str(part_num).zfill(padding)}.mp3"
            new_filepath = os.path.join(self.selected_folder, new_filename)
            
            rename_map[original_filepath] = new_filepath

            # Add metadata
# def add_audiobook_metadata(filepath, book_title, author, genre, year, narrator, snippet, parts):
            success = add_audiobook_metadata(
                filepath=original_filepath, # Tag the original file
                book_title=book_title,
                author=author,
                genre=genre,
                year=year,
                narrator=narrator,
                snippet=part_num,
                total_parts=total_parts,
                snippet_title_prefix="Part" # Use "Part" as the title prefix
            )
            if success:
                processed_count += 1
                self.status_label.setText(f"Status: Tagged {processed_count}/{total_parts} files...")
                QApplication.processEvents() # Update GUI

        # Only rename files if all tagging was successful (or at least attempted for all)
        # This prevents partial renames if some tags failed
        if processed_count == total_parts:
            # Now, perform the renaming
            renamed_count = 0
            for old_path, new_path in rename_map.items():
                try:
                    # Check if the file was actually tagged (it should have been)
                    # and if the new path isn't already the same (e.g., if re-running)
                    if os.path.exists(old_path) and old_path != new_path:
                        os.rename(old_path, new_path)
                        renamed_count += 1
                except Exception as e:
                    print(f"Error renaming {os.path.basename(old_path)} to {os.path.basename(new_path)}: {e}")
                    QMessageBox.warning(self, "Rename Error", f"Could not rename {os.path.basename(old_path)}. Check permissions.")

            self.status_label.setText(f"Status: Tagging and Renaming complete. {processed_count} files processed, {renamed_count} renamed.")
            QMessageBox.information(self, "Success", "All files tagged and renamed successfully!")
            self.load_mp3_files() # Reload to show new filenames
        else:
            self.status_label.setText(f"Status: Completed with errors. {processed_count}/{total_parts} files successfully tagged.")
            QMessageBox.warning(self, "Partial Success", f"Some files failed to be tagged. Check console for errors.")


# --- Main Application Run ---
if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = AudiobookTaggerApp()
    window.show()
    sys.exit(app.exec_())
