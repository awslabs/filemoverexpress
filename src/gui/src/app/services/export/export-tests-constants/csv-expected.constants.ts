export const csvEmptyJobsCaseExpected = 'jobName,direction,remoteConfigurationName,jobId,taskId,destination,source,size,lastModified,status,statusMessage,checksum,priority,error,bytesTransferred';

export const csvOneJobCaseExpected: string = 'jobName,direction,remoteConfigurationName,jobId,taskId,destination,source,size,lastModified,status,statusMessage,checksum,priority,error,bytesTransferred\r\n' +
    '"my-file.txt & others","download","my-remote-config","jobID-abc","taskID-123","/Users/me/Desktop/my-folder/my-file.txt","s3://my-bucket/my-prefix/my-file.txt",1234567,"2024-02-14T19:09:06.392Z","COMPLETED","","",3,"",1234567\r\n' +
    '"my-file.txt & others","download","my-remote-config","jobID-abc","taskID-1234","/Users/me/Desktop/my-folder/my-movie.mov","s3://my-bucket/my-prefix/my-movie.mov",2459483033,"2024-02-14T19:09:06.392Z","COMPLETED","","",2,"",2459483033\r\n' +
    '"my-file.txt & others","download","my-remote-config","jobID-abc","taskID-12345","/Users/me/Desktop/my-folder/my-photos/my-photo1.png","s3://my-bucket/my-prefix/my-photos/my-photo1.png",23423452,"2024-02-14T19:09:06.392Z","COMPLETED","","",1,"",23423452\r\n' +
    '"my-file.txt & others","download","my-remote-config","jobID-abc","taskID-123456","/Users/me/Desktop/my-folder/my-photos/my-photo2.png","s3://my-bucket/my-prefix/my-photos/my-photo2.png",33427552,"2024-02-14T19:09:06.392Z","ERROR","","",4,"a download error occurred",96547';

export const csvTwoJobsCaseExpected: string = 'jobName,direction,remoteConfigurationName,jobId,taskId,destination,source,size,lastModified,status,statusMessage,checksum,priority,error,bytesTransferred\r\n' +
    '"my-model.ma & others","upload","my-remote-config","jobID-abc","task-ID-abc-1","s3://my-bucket/my-prefix/studioA/my-model.ma","/Users/me/studioA/movie/my-model.ma",73296453,"2008-10-21T20:05:06.452Z","In PROGRESS","","1638153c",3,"",1234567\r\n' +
    '"my-model.ma & others","upload","my-remote-config","jobID-abc","task-ID-abc-2","s3://my-bucket/my-prefix/studioA/my-texture.png","/Users/me/studioA/movie/my-texture.png",3724623,"2018-10-21T20:05:06.452Z","COMPLETED","","38bd6879",10,"",3724623\r\n' +
    '"my-script.py","upload","my-remote-config2","jobID-def","task-ID-def-1","s3://my-bucket2/my-prefix/studioB/my-script.py","/Users/me/studioB/my-script.py",87953,"2021-05-21T20:05:06.452Z","COMPLETED","","f5937fa2",4,"",87953';

export const csvMixedJobsCaseExpected: string = 'jobName,direction,remoteConfigurationName,jobId,taskId,destination,source,size,lastModified,status,statusMessage,checksum,priority,error,bytesTransferred\r\n' +
    '"my-model.ma","download","my-remote-config","jobID-abc","taskID-abc-1","C:\\Administrator\\Desktop\\my-movie","s3://my-bucket/",28579285,"2023-02-14T19:09:06.392Z","COMPLETED","","",6,"",28579285\r\n' +
    '"my-script.py","upload","my-remote-config","jobID-def","taskID-def-1","s3://my-bucket/my-prefix/studioB/my-script.py","C:\\Administrator\\Desktop\\studioB\\my-script.py",87953,"2021-05-21T20:05:06.452Z","COMPLETED","","f5937fa2",4,"",87953\r\n' +
    '"my-model.ma & others","upload","my-remote-config","jobID-ghi","taskID-ghi-1","s3://my-bucket/my-prefix/studioA/my-model.ma","C:\\Administrator\\Desktop\\studioA\\movie\\my-model.ma",73296453,"2008-10-21T20:05:06.452Z","In PROGRESS","","1638153c",3,"",1234567\r\n' +
    '"my-model.ma & others","upload","my-remote-config","jobID-ghi","taskID-ghi-2","s3://my-bucket/my-prefix/studioA/my-texture.png","C:\\Administrator\\Desktop\\studioA\\movie\\my-texture.png",3724623,"2018-10-21T20:05:06.452Z","COMPLETED","","38bd6879",10,"",3724623\r\n' +
    '"file1 & others","download","my-remote-config","jobID-jkl","taskID-jkl-1","C:\\Administrator\\Desktop\\my-folder\\file1","s3://my-bucket/file1",1234,"2023-02-14T19:09:06.392Z","In PROGRESS","","c47e6463",1,"",0\r\n' +
    '"file1 & others","download","my-remote-config","jobID-jkl","taskID-jkl-2","C:\\Administrator\\Desktop\\my-folder\\file2","s3://my-bucket/file2",1234,"2023-02-14T19:09:06.392Z","COMPLETED","","",7,"",1234\r\n' +
    '"file1 & others","download","my-remote-config","jobID-jkl","taskID-jkl-3","C:\\Administrator\\Desktop\\my-folder\\file3","s3://my-bucket/file3",1234,"2023-02-14T19:09:06.392Z","COMPLETED","","",2,"",1234\r\n' +
    '"file1 & others","download","my-remote-config","jobID-jkl","taskID-jkl-4","C:\\Administrator\\Desktop\\my-folder\\file4","s3://my-bucket/file4",3724623,"2023-02-14T19:09:06.392Z","COMPLETED","","",12,"",3724623\r\n' +
    '"animation.ma","upload","my-remote-config","jobID-mno","taskID-mno-1","s3://my-bucket/my-prefix/animation.ma","C:\\Administrator\\Desktop\\animation.ma",7329644353,"2008-10-21T20:05:06.452Z","IN PROGRESS","","66d8634",11,"",5646';

export const csvMissingDataCaseExpected: string = 'jobName,direction,remoteConfigurationName,jobId,taskId,destination,source,size,lastModified,status,statusMessage,checksum,priority,error,bytesTransferred\r\n' +
    '"my-file.txt","upload","my-remote-config","","","/my-file.txt","/tmp/my-file.txt",0,"2023-02-14T19:09:06.392Z","","","cc57e6f2",0,"",0';

export const csvWithCommasDataCaseExpected: string = 'jobName,direction,remoteConfigurationName,jobId,taskId,destination,source,size,lastModified,status,statusMessage,checksum,priority,error,bytesTransferred\r\n' +
    '"model, textures, and rig.zip","upload","my, remote-config","jobID, hasComma","taskID, hasComma","s3://my, bucket/my, prefix/animation.ma","C:\\Ad, ministrator\\Desk, top\\animation.ma",7329644353,"2008-10-21T20:05:06.452Z","IN, PROGRESS","no, message","6, 6d8634",11,"no, error",5646';
