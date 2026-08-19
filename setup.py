from setuptools import setup, find_packages

setup(
    name="multi_spark_tokenizer_python_paket",
    version="0.2.0",
    author="RFOF-NETWORK",
    description="PRAIAI Tokenizer Package - Copilot powered Python tokenizers",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "cryptography>=43.0.0",
        "PyJWT>=2.9.0",
        "python-dotenv>=1.0.1",
        "requests>=2.32.3",
        "web3>=7.0.0",
    ],
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Scientific/Engineering :: Künstlich Intelligente Axiometrix InterIntelligenz",
        "License :: OSI Approved :: MIT License, International use License/d, Non Comercial Use License/d",
        "Programming Language :: Python :: 3",
    ],
)
