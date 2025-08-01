﻿using Microsoft.AspNetCore.Http;
using NzbWebDAV.Database.Models;
using NzbWebDAV.Utils;

namespace NzbWebDAV.Api.Controllers.UpdateConfig;

public class UpdateConfigRequest
{
    public List<ConfigItem> ConfigItems { get; init; }

    public UpdateConfigRequest(HttpContext context)
    {
        ConfigItems = context.Request.Form
            .Select(x => new ConfigItem()
            {
                ConfigName = x.Key,
                ConfigValue = x.Value.FirstOrDefault() ?? ""
            })
            .Select(x => x.ConfigName != "webdav.pass" ? x : new ConfigItem()
            {
                ConfigName = x.ConfigName,
                ConfigValue = PasswordUtil.Hash(x.ConfigValue)
            })
            .ToList();
    }
}