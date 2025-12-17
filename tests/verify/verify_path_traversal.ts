
import { LocalFileUploadService } from '../../server/localFileUpload';
import path from 'path';
import fs from 'fs';

// Simple assertion function
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`PASSED: ${message}`);
    }
}

async function runTest() {
    console.log("Starting Path Traversal Verification...");

    const service = new LocalFileUploadService();
    const targetFile = 'temp_verify_delete.txt';
    const absTargetFile = path.resolve(process.cwd(), targetFile);

    // Create a dummy file in the root
    fs.writeFileSync(absTargetFile, 'do not delete me');

    // Attempt to delete it via traversal
    // traversal: ../../temp_verify_delete.txt

    const traversalPath = `../../${targetFile}`;
    console.log(`Attempting to delete: ${traversalPath}`);

    try {
        const result = service.deleteFile(traversalPath);

        // We expect result to be FALSE after the fix

        if (fs.existsSync(absTargetFile)) {
             console.log("SUCCESS: File was NOT deleted.");
        } else {
             console.error("FAILURE: File WAS deleted!");
             process.exit(1);
        }

    } catch (e) {
        console.log("Caught expected error or rejection:", e);
        if (fs.existsSync(absTargetFile)) {
            console.log("SUCCESS: File was NOT deleted (exception thrown).");
       } else {
            console.error("FAILURE: File WAS deleted even with exception!");
            process.exit(1);
       }
    } finally {
        // Cleanup
        if (fs.existsSync(absTargetFile)) {
            fs.unlinkSync(absTargetFile);
        }
    }
}

runTest();
