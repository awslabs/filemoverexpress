# Setting up File Mover Express

Before you use File Mover Express for the first time, complete the following tasks.

## Prerequisites

### Sign up for an AWS account

If you do not have an AWS account, complete the following steps to create one.

#### To sign up for an AWS account

1. Open https://portal.aws.amazon.com/billing/signup.
2. Follow the online instructions.
   - Part of the sign-up procedure involves receiving a phone call and entering a verification code on the phone keypad.
   - When you sign up for an AWS account, an *AWS account root user* is created. The root user has access to all AWS services and resources in the account. As a security best practice, [assign administrative access to an administrative user](https://docs.aws.amazon.com/singlesignon/latest/userguide/getting-started.html), and use only the root user to perform [tasks that require root user access](https://docs.aws.amazon.com/accounts/latest/reference/root-user-tasks.html).
3. AWS sends you a confirmation email after the sign-up process is complete. At any time, you can view your current account activity and manage your account by going to https://aws.amazon.com/ and choosing **My Account**.

### Create an administrative user

After you sign up for an AWS account, create an administrative user so that you don't use the root user for everyday tasks.

#### Secure your AWS account root user

1. Sign in to the [AWS Management Console](https://console.aws.amazon.com/) as the account owner by choosing **Root user** and entering your AWS account email address. On the next page, enter your password.
   - For help signing in by using root user, see [Signing in as the root user](https://docs.aws.amazon.com/signin/latest/userguide/console-sign-in-tutorials.html#introduction-to-root-user-sign-in-tutorial) in the *AWS Sign-In User Guide*.
2. Turn on multi-factor authentication (MFA) for your root user.
   - For instructions, see [Enable a virtual MFA device for your AWS account root user (console)](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_enable_virtual.html#enable-virt-mfa-for-root) in the *IAM User Guide*.

#### Create an administrative user

1. For your daily administrative tasks, grant administrative access to an administrative user in AWS IAM Identity Center (successor to AWS Single Sign-On).
   - For instructions, see [Getting started](https://docs.aws.amazon.com/singlesignon/latest/userguide/getting-started.html) in the *AWS IAM Identity Center User Guide*.

#### Sign in as the administrative user

1. To sign in with your IAM Identity Center user, use the sign-in URL that was sent to your email address when you created the IAM Identity Center user.
   - For help signing in using an IAM Identity Center user, see [Signing in to the AWS access portal](https://docs.aws.amazon.com/signin/latest/userguide/iam-id-center-sign-in-tutorial.html) in the *AWS Sign-In User Guide*.

## Create an S3 bucket

> **Important**: Before you can use File Mover Express, you must complete the [Setting up Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/setting-up-s3.html) tutorial. If Amazon S3 isn't properly configured, the security of the contents in your bucket could become compromised.

You must also complete the [Create your first S3 bucket](https://docs.aws.amazon.com/AmazonS3/latest/userguide/creating-bucket.html) tutorial with these recommendations:

- **(Recommended) Enable Bucket Versioning** in step 8:
  - This ensures that your data isn't lost if you accidentally overwrite a file in Amazon S3 with a new version.
  - Enabling bucket versioning accrues additional cost. For more information about Amazon S3 pricing, see the [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/) page.

- **(Recommended) Use AWS Key Management Service key (SSE-KMS)** in step 11:
  - If you don't have an SSE-KMS key, create one by following the instructions in the [Creating symmetric encryption KMS key](https://docs.aws.amazon.com/kms/latest/developerguide/create-keys.html#create-symmetric-cmk) tutorial.
  - For more information about different types of keys, see the [Customer keys and AWS keys page](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#key-mgmt).
  - To allow someone to use the bucket from another AWS account, you must use a customer managed key.
  - It's difficult to change the key after you create the bucket, so make sure that you create your bucket with the correct keys.

- Leave all other settings and user preferences at their defaults.

## Create an IAM Access Policy

Next, you must create an IAM access policy that gives permission to the Amazon S3 bucket that you created. After that, you'll attach this IAM policy to an IAM user. This IAM user will generate the credentials that File Mover Express needs to access the Amazon S3 bucket.

Follow the [Creating policies on the JSON tab](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create-console.html#access_policies_create-json-editor) tutorial in the *IAM User Guide* and use the appropriate JSON policy document below.

### Using a Customer Managed Key from KMS (SSE-KMS)

Enter the following text in the JSON template to provide the required access for Amazon S3 uploads and downloads:

> **Note**: To allow deleting objects in the S3 bucket, include the actions listed in the statement with Sid "OptionalActions". You do not need to include those actions if you do not want to allow deleting S3 objects.

```json
{ 
    "Statement": [ 
        {
            "Sid": "RequiredActions",
            "Action": [
                "s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:PutObject",
                "s3:GetObject",
                "s3:GetObjectTagging"
            ],
            "Effect": "Allow",
            "Resource": [
                "arn:aws:s3:::bucket-name",
                "arn:aws:s3:::bucket-name/*"
            ]
        },
        { 
            "Sid": "KMSKeyAccess", 
            "Action": [ 
                "kms:GenerateDataKey*", 
                "kms:Encrypt", 
                "kms:Decrypt" 
            ], 
            "Effect": "Allow", 
            "Resource": "arn:aws:kms:key-region:account-number:key/key-id" 
        },
        {
            "Sid": "OptionalActions",
            "Action": [
                "s3:DeleteObject",
                "s3:DeleteObjectVersion",
                "s3:ListBucketVersions",
                "s3:AbortMultipartUpload"
            ],
            "Effect": "Allow",
            "Resource": [
                "arn:aws:s3:::bucket-name",
                "arn:aws:s3:::bucket-name/*"
            ]
        }
    ], 
    "Version": "2012-10-17" 
}
```

Replace the following placeholders:
- `bucket-name` with the name of the bucket you created
- `key-region` with the AWS Region where you created your key
- `account-number` with your AWS account number
- `key-id` with the ID of the KMS key you chose

To find the KMS key ID, follow the instructions in the [Viewing the settings for an S3 Bucket Key](https://docs.aws.amazon.com/AmazonS3/latest/userguide/viewing-bucket-key-settings.html) tutorial.

### Using an Amazon Managed KMS key (SSE-S3)

1. Check if your bucket has an active KMS key by following the instructions in the [Viewing settings for an S3 Bucket Key](https://docs.aws.amazon.com/AmazonS3/latest/userguide/viewing-bucket-key-settings.html) tutorial.
   - If you aren't using a KMS key, proceed to step 2.
   - If you do have a KMS key attached to the bucket, follow the instructions for **Using a Customer Managed Key from KMS (SSE-KMS)** above.

2. Enter the following text in the JSON template:

```json
{
    "Statement": [
        {
            "Sid": "RequiredActions",
            "Action": [
                "s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:PutObject",
                "s3:GetObject",
                "s3:GetObjectTagging"
            ],
            "Effect": "Allow",
            "Resource": [
                "arn:aws:s3:::bucket-name",
                "arn:aws:s3:::bucket-name/*"
            ]
        },
        {
            "Sid": "OptionalActions",
            "Action": [
                "s3:DeleteObject",
                "s3:DeleteObjectVersion",
                "s3:ListBucketVersions",
                "s3:AbortMultipartUpload"
            ],
            "Effect": "Allow",
            "Resource": [
                "arn:aws:s3:::bucket-name",
                "arn:aws:s3:::bucket-name/*"
            ]
        }
    ],
    "Version": "2012-10-17"
}
```

Replace `bucket-name` with the name of the bucket you created.

## Set up the AWS CLI

Install and configure the AWS CLI if you haven't already. File Mover Express uses AWS CLI named profiles to handle and store IAM credentials.

1. Install or upgrade the AWS CLI by following the instructions in [Installing the AWS Command Line Interface version 2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

2. Configure the AWS CLI by following the instructions in [Configuration and credential file settings](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html).

3. Verify that you created an **AWS named profile** by running:
   ```bash
   aws --profile [name of profile you created in step 2] sts get-caller-identity
   ```

   **Example**: This command should generate output similar to:
   ```bash
   aws --profile filemoverexpress sts get-caller-identity
   {
       "UserId": "ARXXXXXXXXXXXXXXXXXXX:username",
       "Account": "123456789012",
       "Arn": "arn:aws:sts::123456789012:XXXXXXXXXXXXXXX..."
   }
   ```

We recommend reading about additional AWS CLI security controls in the [AWS Command Line Interface User Guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html).

## (Optional) AWS IAM Identity Center with External Identity Provider

AWS IAM Identity Center is a cloud-based single sign-on service for managing users and groups. IAM Identity Center can be integrated with your enterprise SSO provider so users can sign in with their company account.

If you are using AWS IAM Identity Center to authenticate identities from another Identity Provider through SAML 2.0, see the AWS IAM Identity Center documentation for detailed configuration instructions.

## Next Steps

After completing the setup, proceed to:
- [Installation](Installation) - Install File Mover Express
- [Configuration](Configuration) - Configure File Mover Express for your environment