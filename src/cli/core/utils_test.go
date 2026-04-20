package core

import (
	"encoding/hex"
	"errors"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestContainsUnsupportedCharsReturnsFalseForSupportedFilenames(t *testing.T) {
	// https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html

	//test the good
	goodFileName1 := "4my-organization"
	assert.False(t, ContainsUnsupportedChars(goodFileName1))

	goodFileName2 := "my.great_photos-2014/jan/myvacation.jpg"
	assert.False(t, ContainsUnsupportedChars(goodFileName2))

	goodFileName3 := "videos/2014/birthday/video1.wmv"
	assert.False(t, ContainsUnsupportedChars(goodFileName3))

	alphanumerics := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
	assert.False(t, ContainsUnsupportedChars(alphanumerics))

	specialCharacters := "-/!_.*'()"
	assert.False(t, ContainsUnsupportedChars(specialCharacters))

	singleSpace := "one space"
	assert.False(t, ContainsUnsupportedChars(singleSpace))
}

func TestContainsUnsupportedCharsReturnsTrueForCharsThatRequireSpecialHandling(t *testing.T) {
	// https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html

	hasAmpersand := "this has ampersand &"
	assert.True(t, ContainsUnsupportedChars(hasAmpersand))

	hasDollarSign := "this has dollar $ign"
	assert.True(t, ContainsUnsupportedChars(hasDollarSign))

	//ASCII character ranges 00–1F hex (0–31 decimal) and 7F (127 decimal)
	ascii00 := "00"
	asciiCharsInRange00, err := hex.DecodeString(ascii00)
	assert.Nil(t, err)
	assert.True(t, ContainsUnsupportedChars(string(asciiCharsInRange00)))
	ascii1f := "1f"
	asciiCharsInRange1f, err := hex.DecodeString(ascii1f)
	assert.Nil(t, err)
	assert.True(t, ContainsUnsupportedChars(string(asciiCharsInRange1f)))

	hasAtSymbol := "this h@s @t symbol"
	assert.True(t, ContainsUnsupportedChars(hasAtSymbol))

	hasEquals := "this/has/=/sign"
	assert.True(t, ContainsUnsupportedChars(hasEquals))

	hasSemicolon := "has;semicolon"
	assert.True(t, ContainsUnsupportedChars(hasSemicolon))

	hasColon := "has:colon"
	assert.True(t, ContainsUnsupportedChars(hasColon))

	hasPlus := "has+sign"
	assert.True(t, ContainsUnsupportedChars(hasPlus))

	hasTooManySpaces := "has  more than one continuous space"
	assert.True(t, ContainsUnsupportedChars(hasTooManySpaces))

	hasComma := "has,"
	assert.True(t, ContainsUnsupportedChars(hasComma))

	hasQuestion := "has?"
	assert.True(t, ContainsUnsupportedChars(hasQuestion))
}

func TestContainsUnsupportedCharsReturnsTrueForCharsToAvoid(t *testing.T) {
	// https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html

	hasBackslash := "this has backslash \\"
	assert.True(t, ContainsUnsupportedChars(hasBackslash))

	hasLeftBrace := "thishas{"
	assert.True(t, ContainsUnsupportedChars(hasLeftBrace))

	//Non-printable ASCII characters (128–255 decimal characters)
	nonPrintableLowerEnd := "80"
	asciiCharsInRange80, _ := hex.DecodeString(nonPrintableLowerEnd)
	assert.True(t, ContainsUnsupportedChars(string(asciiCharsInRange80)))
	nonPrintableUpperEnd := "FF"
	asciiCharsInRangeFF, _ := hex.DecodeString(nonPrintableUpperEnd)
	assert.True(t, ContainsUnsupportedChars(string(asciiCharsInRangeFF)))

	hasCaret := "thishas^"
	assert.True(t, ContainsUnsupportedChars(hasCaret))

	hasRightBrace := "thishas}"
	assert.True(t, ContainsUnsupportedChars(hasRightBrace))

	hasPercent := "has%percent"
	assert.True(t, ContainsUnsupportedChars(hasPercent))

	hasBacktick := "has`backtick"
	assert.True(t, ContainsUnsupportedChars(hasBacktick))

	hasRightBracket := "has]"
	assert.True(t, ContainsUnsupportedChars(hasRightBracket))

	hasQuote := "has\"quote"
	assert.True(t, ContainsUnsupportedChars(hasQuote))

	hasGreaterThan := "has>gt"
	assert.True(t, ContainsUnsupportedChars(hasGreaterThan))

	hasLeftBracket := "has[leftbracket"
	assert.True(t, ContainsUnsupportedChars(hasLeftBracket))

	hasTilde := "has~tilde"
	assert.True(t, ContainsUnsupportedChars(hasTilde))

	hasLessThan := "has<"
	assert.True(t, ContainsUnsupportedChars(hasLessThan))

	hasPound := "#sign"
	assert.True(t, ContainsUnsupportedChars(hasPound))

	hasPipe := "has|pipe"
	assert.True(t, ContainsUnsupportedChars(hasPipe))
}

func TestCreateOutputFileAndDestDir(t *testing.T) {
	type args struct {
		filePath string
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		{
			name: "Create Output File and Dir",
			args: args{
				filePath: "/tmp/TestCreateOutputFileAndDestDir/test1/test.txt",
			},
			wantErr: false,
		},
		{
			name: "Create dir that already exists",
			args: args{
				filePath: "/tmp/TestCreateOutputFileAndDestDir/AlreadyExists/file.txt",
			},
			wantErr: false,
		},
	}
	if mkdirErr := os.MkdirAll("/tmp/TestCreateOutputFileAndDestDir/AlreadyExists", os.ModePerm); mkdirErr != nil {
		t.Errorf("TestCreateOutputFileAndDestDir: Error creating temp dir: %v", mkdirErr)
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := CreateOutputFileAndDestDir(tt.args.filePath)
			if (err != nil) != tt.wantErr {
				t.Errorf("CreateOutputFileAndDestDir() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
	if removeErr := os.RemoveAll("/tmp/TestCreateOutputFileAndDestDir"); removeErr != nil {
		t.Logf("TestCreateOutputFileAndDestDir: Error removing temp dir: %v", removeErr)
	}
}

func TestDirExists(t *testing.T) {
	type args struct {
		dirPath string
	}
	tests := []struct {
		name    string
		args    args
		want    bool
		wantErr bool
	}{
		{
			name: "Dir does not exist",
			args: args{
				dirPath: "/tmp/transferAPITestDirExists/DoesNotExist",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "Dir exists",
			args: args{
				dirPath: "/tmp/transferAPITestDirExists/Exists",
			},
			want:    true,
			wantErr: false,
		},
	}
	if mkdirErr := os.MkdirAll("/tmp/transferAPITestDirExists/Exists", os.ModePerm); mkdirErr != nil {
		t.Errorf("TestDirExists: Error creating temp dir: %v", mkdirErr)
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := DirExists(tt.args.dirPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("DirExists() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("DirExists() got = %v, want %v", got, tt.want)
			}
		})
	}
	if removeErr := os.RemoveAll("/tmp/transferAPITestDirExists"); removeErr != nil {
		t.Logf("TestDirExists: Error removing temp dirs: %v", removeErr)
	}
}

func TestCause(t *testing.T) {
	err := errors.New("fail")
	cause := Cause(err)
	assert.Equal(t, err, cause)
}
