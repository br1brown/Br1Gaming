using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Backend.Services;
using Backend.Infrastructure;

var store = new FileContentStore(new DummyEnv());
var gs = new GeneratorService(store);
var res = await gs.GenerateIncelAsync();
Console.WriteLine(res.Text);

class DummyEnv : Microsoft.AspNetCore.Hosting.IWebHostEnvironment
{
    public string WebRootPath { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }
    public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }
    public string ApplicationName { get => "Backend"; set => throw new NotImplementedException(); }
    public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get => throw new NotImplementedException(); set => throw new NotImplementedException(); }
    public string ContentRootPath { get => "c:\\Users\\br1br\\source\\repos\\Br1Gaming\\backend"; set => throw new NotImplementedException(); }
    public string EnvironmentName { get => "Development"; set => throw new NotImplementedException(); }
}
